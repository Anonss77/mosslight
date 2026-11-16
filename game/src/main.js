
import { Game, STEP } from './game.js';
import { createWorld } from './world.js';
import { Audio } from './audio.js';
import { Input } from './input.js';

function fitStage() {
  if (world && world.resize) world.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', fitStage);
window.addEventListener('orientationchange', fitStage);

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '20261116', 10);
const shot = params.get('shot');
const autotest = params.get('autotest') === '1';
const speed = Math.max(1, Math.min(30, parseInt(params.get('speed') || '10', 10)));

const audio = new Audio();
if (autotest || shot) audio.headless = true;

const canvas = document.getElementById('game');
const world = autotest
  ? { setField() {}, setArea() {} }
  : createWorld(canvas);

if (!autotest) fitStage();

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
  if(matchMedia('(pointer:coarse)').matches){try{document.documentElement.requestFullscreen().catch(()=>{}),screen.orientation.lock('landscape').catch(()=>{})}catch(e){}}
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

let paused = false;
let bagOpen = false;
function setPaused(p) {
  paused = p;
  pausePanel.classList.toggle('hidden', !p);
}

function renderBag() {
  const b = game.bag || { heart: 0, bomb: 0, magnet: 0 };
  $('bagCoins').textContent = `🪙 ${game.coins}   💎 ${game.shards}`;
  for (const k of ['heart', 'bomb', 'magnet']) {
    document.getElementById(`bag${k[0].toUpperCase() + k.slice(1)}N`).textContent = `x${b[k]}`;
    document.getElementById(`bag-${k}`).classList.toggle('empty', b[k] <= 0);
  }
}
function setBag(open) {
  bagOpen = open;
  game.bagOpen = open;
  $('bagPanel').classList.toggle('hidden', !open);
  if (open) renderBag();
}
$('bagBtn').addEventListener('click', () => { if (game.state === 'playing' || bagOpen) setBag(!bagOpen); });
$('bagCloseBtn').addEventListener('click', () => setBag(false));
for (const k of ['heart', 'bomb', 'magnet']) {
  document.getElementById(`bag-${k}`).addEventListener('click', () => { if (game.useBagItem(k)) renderBag(); });
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
  if (bagOpen) { setBag(false); return; }
  if (game.state === 'playing' || game.state === 'intermission') setPaused(!paused);
};
input.onBag = () => { if (game.state === 'playing' || bagOpen) setBag(!bagOpen); };
input.bindJoystick($('joystick'), $('joyThumb'));
input.bindCamera($('game'));
$('camBtn').addEventListener('click', () => { if (window.__cam) { window.__cam.az = 0; window.__cam.tilt = 38; window.__cam.vaz = 0; window.__cam.vtilt = 0; } });
for (const id of ['crescent', 'ember', 'glassguard', 'starfall', 'frost']) {
  input.bindSkillButton($('skill-' + id), id);
}
input.bindSkillButton($('attackBtn'), 'attack');

if (autotest) {

  game.startRun();
  showHud();
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

  world.loadNeri();
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

      world.render();
      if (shot && !window.__mosslight.shotReady && world.isNeriLoaded()) {
        window.__mosslight.shotReady = true;
      }
      return;
    }
    if (shot === 'start') {

      world.sync(game, dt);
      world.render();
      if ((frames > 40 && world.isNeriLoaded()) || frames > 300) {
        game.shotReady = true;
        window.__mosslight.shotReady = true;
      }
      return;
    }
    if (shot) {

      for (let i = 0; i < speed; i++) game.step(STEP);
      if (game.done && !game.maybeRestartShot()) game.shotReady = true;
      else if (game.shotConditionMet()) game.shotReady = true;
      world.sync(game, dt);
      game.updateHUD();
      if (game.shotReady) game.drawMinimap();
      return;
    }
    game.step(STEP);
    world.sync(game, dt);
    world.render();
    game.updateHUD();
  }
  requestAnimationFrame(frame);
}
