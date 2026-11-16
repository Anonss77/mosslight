// Mosslight v4 — bootstrap (3D). Creates the world + game, fits the
// 1280x720 stage to the window, and drives the test hooks:
//   ?shot=start|combat|cinder|boss&seed=N — stage the composition, freeze
//     the sim, set window.__mosslight.shotReady = true.
//   ?autotest=1&seed=N&speed=K — play a whole run with the deterministic
//     bot (no rendering), set window.__mosslight.done.
import { Game, STEP } from './game.js';
import { createWorld } from './world.js';
import { Audio } from './audio.js';
import { Input } from './input.js';

// Fit the fixed 1280x720 stage into the window, letterboxed.
function fitStage() {
  const stage = document.getElementById('stage');
  const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  stage.style.transform = `scale(${s})`;
}
window.addEventListener('resize', fitStage);
fitStage();

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '20261116', 10);
const shot = params.get('shot');
const autotest = params.get('autotest') === '1';
const speed = Math.max(1, Math.min(30, parseInt(params.get('speed') || '10', 10)));

const audio = new Audio();
if (autotest || shot) audio.headless = true;

// In autotest mode there is no rendering: a stub world (the sim only
// calls world.setDungeon / world.setArea) keeps WebGL out of the run.
const canvas = document.getElementById('game');
const world = autotest
  ? { setDungeon() {}, setArea() {} }
  : createWorld(canvas);
// The stage is a fixed 1280x720: set the renderer + camera aspect once.
// (resize() was never called, so the camera kept aspect 1 and the whole
// 3D view was stretched 1.78x horizontally.)
if (!autotest) world.resize(1280, 720);

const game = new Game(world, audio, { seed, autotest: autotest || !!shot, shot: shot || null, speed });
window.__mosslight = { game, shotReady: false, done: null };

const $ = (id) => document.getElementById(id);
const titlePanel = $('titlePanel');
const hud = $('hud');
const pausePanel = $('pausePanel');

function showTitle() {
  titlePanel.classList.remove('hidden');
  hud.classList.add('hidden');
  pausePanel.classList.add('hidden');
  const best = Number(localStorage.getItem('mosslight-best') || 0);
  const bestEl = $('bestScore');
  if (bestEl) bestEl.textContent = `Best: ${best} pts`;
}

function showHud() {
  titlePanel.classList.add('hidden');
  hud.classList.remove('hidden');
}

function startRunWithSeed(s) {
  game.seed = s;
  game.hideResult();
  game.startRun();
  showHud();
}

$('startBtn').addEventListener('click', () => {
  const typed = parseInt(($('seedInput').value || '').trim(), 10);
  startRunWithSeed(Number.isFinite(typed) ? typed : game.seed);
  audio.unlock();
});
$('againBtn').addEventListener('click', () => startRunWithSeed(game.seed + 1));
$('titleBtn').addEventListener('click', () => {
  game.hideResult();
  game.buildRun();
  game.state = 'title';
  showTitle();
});
$('muteBtn').addEventListener('click', () => {
  const muted = audio.toggleMute();
  $('muteBtn').textContent = muted ? '🔇' : '🔊';
});

// Pause (Escape): freeze the sim, keep rendering the frozen frame.
let paused = false;
function setPaused(p) {
  paused = p;
  pausePanel.classList.toggle('hidden', !p);
}
$('resumeBtn').addEventListener('click', () => setPaused(false));
$('restartBtn').addEventListener('click', () => { setPaused(false); startRunWithSeed(game.seed); });
$('quitBtn').addEventListener('click', () => {
  setPaused(false);
  game.buildRun();
  game.state = 'title';
  showTitle();
});

const input = new Input();
input.onPause = () => {
  if (game.state === 'playing' || game.state === 'intermission') setPaused(!paused);
};
input.bindJoystick($('joystick'), $('joyThumb'));
for (const id of ['crescent', 'ember', 'glassguard', 'starfall']) {
  input.bindSkillButton($('skill-' + id), id);
}

if (autotest) {
  // No rendering: run the sim as fast as possible in slices, so the
  // verification poll can still reach the page between slices.
  game.startRun();
  const runChunk = () => {
    const t0 = Date.now();
    while (!game.done && Date.now() - t0 < 150) game.step(STEP);
    if (game.done) {
      window.__mosslight.done = game.done;
    } else {
      setTimeout(runChunk, 0);
    }
  };
  runChunk();
} else {
  // Rendering loop (normal play + shot staging).
  world.loadNeri(); // the hero loads in the background; sync picks her up
  if (shot && shot !== 'start') {
    showHud();
    game.startRun();
  } else {
    showTitle();
  }
  let last = performance.now();
  let frames = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000));
    last = now;
    frames++;
    if (paused) { world.render(); return; }
    if (game.shotReady) {
      // Frozen composition: render it, and only signal the harness once
      // Neri is actually loaded, so the screenshot includes her.
      world.render();
      if (shot && !window.__mosslight.shotReady && world.isNeriLoaded()) {
        window.__mosslight.shotReady = true;
      }
      return;
    }
    if (shot === 'start') {
      // Title composition: let Neri settle into her Idle pose, then freeze.
      world.sync(game, dt);
      world.render();
      if ((frames > 40 && world.isNeriLoaded()) || frames > 300) {
        game.shotReady = true;
        window.__mosslight.shotReady = true;
      }
      return;
    }
    if (shot) {
      // Gameplay-shot fast-forward: step the sim WITHOUT rendering.
      // SwiftShader renders ~1 frame/s, so rendering every frame made a
      // combat shot take >300s. Sync still runs (cheap) so the GLB loads
      // and the meshes track the sim; the HUD stays current for the freeze.
      for (let i = 0; i < speed; i++) game.step(STEP);
      if (game.done && !game.maybeRestartShot()) game.shotReady = true;
      else if (game.shotConditionMet()) game.shotReady = true;
      world.sync(game, dt);
      game.updateHUD();
      if (game.shotReady) game.drawMinimap(); // freeze the minimap too
      return;
    }
    game.step(STEP);
    world.sync(game, dt);
    world.render();
    game.updateHUD();
  }
  requestAnimationFrame(frame);
}
