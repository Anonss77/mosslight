// Mosslight — deterministic RNG (Mulberry32). One seed drives the whole run:
// dungeon layout, spawns, loot rolls, and upgrade offers. Same seed in,
// same run out.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Small helper bag over one RNG stream.
export class Rng {
  constructor(seed) { this.next = mulberry32(seed); }
  float() { return this.next(); }
  // integer in [min, max)
  int(min, max) { return min + Math.floor(this.next() * (max - min)); }
  // float in [min, max)
  range(min, max) { return min + this.next() * (max - min); }
  // true with probability p
  chance(p) { return this.next() < p; }
  // pick one element
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  // in-place Fisher-Yates shuffle, returns the array
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
