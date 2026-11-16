// Mosslight — bootstrap. Creates the game, fits the 1280x720 stage to the
// window, and drives the test hooks used by screenshots and verification:
//   ?shot=start|combat|boss|victory&seed=N  — stage one composition, freeze
//     the sim, set window.__mosslight.shotReady = true.
//   ?autotest=1&seed=N&speed=K             — play a whole run with the
//     deterministic bot at Kx speed, set window.__mosslight.done.

import { Game } from './game.js';
import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, SCALE, BOSS } from './config.js';

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

// Place a world point at screen (sx, sy) by offsetting the camera.
// The render clamps the camera to the PLAYER's position first, then adds
// camOffset — so the clamp base here must be the player, not the anchor.
function framePoint(wx, wy, sx, sy) {
  const p = game.player;
  const cx0 = Math.max(0, Math.min(WORLD_W * SCALE - VIEW_W, p.x * SCALE - VIEW_W / 2));
  const cy0 = Math.max(0, Math.min(WORLD_H * SCALE - VIEW_H, p.y * SCALE - VIEW_H / 2));
  game.camOffset = { x: (wx * SCALE - sx) - cx0, y: (wy * SCALE - sy) - cy0 };
}

// Stage one visible interactive reaction per kind near the player, plus
// the cast frame, for combat screenshots (visual staging only).
function stageCombat() {
  const p = game.player;
  p.castT = 0.16;
  p.energy = 100;
  for (const k of Object.keys(p.cooldowns)) p.cooldowns[k] = 0;
  for (const st of game.interState) {
    const d = Math.hypot(p.x - st.slot.x, p.y - st.slot.y);
    if (d > 220) continue;
    if (st.kind === 'flower') { st.tilt = 12 * Math.PI / 180; st.tiltT = 0.5; }
    else if (st.kind === 'pot' && !st.broken) { st.broken = true; game.particles.burst(st.slot.x, st.slot.y, 4, ['#8A5548', '#6FCB73', '#A7E68A'], game.visualRng, 80); }
    else if (st.kind === 'vine' || st.kind === 'crystal' || st.kind === 'rune') st.glow = 1;
    else if (st.kind === 'brazier') st.flare = 1;
    else if (st.kind === 'rack') { st.sparkT = 0.5; game.particles.burst(st.slot.x, st.slot.y - 6, 3, ['#B2FFFF', '#FFFFFF', '#65D5D5'], game.visualRng, 50); }
    else if (st.kind === 'gear') st.rot = 0.15;
    else if (st.kind === 'starflower') st.open = 1;
  }
}

if (shot) {
  game.botMode = true;
  game.speed = speed;
  if (shot === 'start') {
    // Opening room (Bloomroot): Neri near spawn, lantern + moth, decor
    // visible, no swarm. Freeze at 3 sim-seconds so the bot has walked
    // toward the room's centre (the camera is less clamped there).
    game.speed = 1;
    game.startRun(seed);
    const check = setInterval(() => {
      if (game.time >= 3) {
        // Neri slightly left of center, room around her.
        framePoint(game.player.x, game.player.y, 560, 380);
        game.render(); freeze();
        clearInterval(check);
      }
    }, 300);
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
        // Bloomroot combat (waves 1-3): busy fight, cast frame, reactions.
        // If the poll misses the wave 1-3 window, restart on the next
        // seed instead of catching a later area by accident.
        if (game.wave > 3) {
          attempts++;
          if (attempts > 2) { clearInterval(check); freeze(); return; }
          game.startRun(seed + attempts);
          return;
        }
        const many = game.enemies.length >= 8;
        const loot = game.loot.list.length >= 1;
        if ((game.wave >= 2 || many) && many && loot && game.player.alive) {
          stageCombat();
          freeze();
          clearInterval(check);
        }
      } else if (shot === 'cinder') {
        // Cinderglass combat (waves 4-6): anvil/gear/glass in frame.
        const many = game.enemies.length >= 8;
        if (game.area === 1 && game.player.alive && many) {
          stageCombat();
          freeze();
          clearInterval(check);
        }
      } else if (shot === 'boss') {
        const b = game.boss;
        // Fire only while Neri is below the boss, so the frame reads
        // bell upper-center / Neri lower-center (Astra's composition).
        if (game.wave === 8 && b && !b.dead && b.hp < b.maxHp * 0.5 && game.enemies.length >= 3 && game.player.y > b.y + 30) {
          // Force the ring telegraph (warning ring) for a readable shot.
          const dx = game.player.x - b.x, dy = game.player.y - b.y;
          b.state = 'telegraph';
          b.telegraph = { kind: 'ring', x: game.player.x, y: game.player.y, angle: Math.atan2(dy, dx), t: 0.3, dur: BOSS.ringTime };
          b.stateT = 0.3;
          game.player.energy = 100;
          for (const k of Object.keys(game.player.cooldowns)) game.player.cooldowns[k] = 0;
          game.player.castT = 0.16;
          // Frame the bell upper-center; Neri (below the boss) lands
          // lower-center.
          framePoint(b.x, b.y, 640, 270);
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
