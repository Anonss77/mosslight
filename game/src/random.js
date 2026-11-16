// Mosslight v4 — deterministic RNG (Mulberry32, the design's chosen PRNG).
// Fresh implementation from the algorithm's definition; no Math.random
// anywhere in the game. One stream per purpose so visuals never shift
// gameplay rolls: the run stream feeds dungeon/spawns/loot/offers, the
// visual stream feeds decor and particle jitter only.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Small helpers over a stream. All deterministic.
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // float in [0, 1)
    f() { return next(); },
    // float in [min, max)
    range(min, max) { return min + next() * (max - min); },
    // integer in [min, max] inclusive
    int(min, max) { return min + Math.floor(next() * (max - min + 1)); },
    // pick one element
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    // Fisher-Yates shuffle, in place, deterministic
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    },
    // true with probability p
    chance(p) { return next() < p; },
  };
}
