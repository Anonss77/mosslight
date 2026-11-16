// Mosslight — bootstrap. Creates the game, fits the 1280x720 stage to the
// window, and drives the test hooks used by screenshots and verification:
//   ?shot=start|combat|boss|victory&seed=N  — stage one composition, freeze
//     the sim, set window.__mosslight.shotReady = true.
//   ?autotest=1&seed=N&speed=K             — play a whole run with the
//     deterministic bot at Kx speed, set window.__mosslight.done.

import { Game } from './game.js';
import { VIEW_W, VIEW_H } from './config.js';

// Fit the fixed 1280x720 stage into the window, letterboxed.
function fitStage() {
  const stage = document.getElementById('stage');
  const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  stage.style.transform = `scale(${s})`;
}
window.addEventListener('resize', fitStage);
fitStage();

const canvas = document.getElementById('game');
const game = new Game(canvas);
game.start();

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '20261116', 10);
const shot = params.get('shot');
const autotest = params.get('autotest') === '1';
const speed = Math.max(1, Math.min(30, parseInt(params.get('speed') || '10', 10)));

window.__mosslight = { game, shotReady: false, done: null };

function freeze() {
  game.frozen = true;
  window.__mosslight.shotReady = true;
}

if (shot) {
  game.botMode = true;
  game.speed = speed;
  if (shot === 'start') {
    // Title screen only.
    setTimeout(() => { game.render(); freeze(); }, 400);
  } else {
    game.startRun(seed);
    let attempts = 0;
    const check = setInterval(() => {
      // The bot died or the run ended early: retry with the next seed.
      if ((game.state === 'defeat' || game.state === 'victory') && shot !== 'victory') {
        attempts++;
        if (attempts > 2) { clearInterval(check); freeze(); return; }
        game.startRun(seed + attempts);
        return;
      }
      if (shot === 'combat') {
        const many = game.enemies.length >= 12;
        const loot = game.loot.list.length >= 2;
        if ((game.wave >= 2 || many) && many && loot && game.player.alive) {
          // One visible ember patch for the shot.
          game.embers.spawn(game.player.x + 60, game.player.y - 20, 12, 8);
          freeze();
          clearInterval(check);
        }
      } else if (shot === 'boss') {
        const b = game.boss;
        if (game.wave === 8 && b && !b.dead && b.hp < b.maxHp * 0.5 && game.enemies.length >= 3) {
          // Force the Shard Fan telegraph mid-flight for a readable shot.
          const dx = game.player.x - b.x, dy = game.player.y - b.y;
          b.state = 'telegraph';
          b.telegraph = { kind: 'fan', x: game.player.x, y: game.player.y, angle: Math.atan2(dy, dx), t: 0.3, dur: 0.6 };
          b.stateT = 0.3;
          game.player.energy = 100;
          for (const k of Object.keys(game.player.cooldowns)) game.player.cooldowns[k] = 0;
          freeze();
          clearInterval(check);
        }
      } else if (shot === 'victory') {
        if (game.state === 'victory') {
          freeze();
          clearInterval(check);
        }
      }
    }, 300);
  }
} else if (autotest) {
  game.botMode = true;
  game.headless = true;
  game.speed = speed;
  game.startRun(seed);
  const check = setInterval(() => {
    if (game.done) {
      window.__mosslight.done = game.done;
      clearInterval(check);
    }
  }, 300);
}
