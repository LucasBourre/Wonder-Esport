// --- Hasard seedable (déterminisme opt-in) -------------------------------
// Par défaut : Math.random → carrières normales 100 % aléatoires.
// setSeed(n) bascule sur un PRNG reproductible (mulberry32) : le Défi du jour
// et les duels deviennent déterministes — même graine + mêmes choix ⇒
// carrière identique (la divergence n'apparaît qu'après un choix différent).
// L'état tient dans UN entier (getSeedState/setSeedState) → sérialisable dans
// l'autosave pour une reprise déterministe. rng() est l'UNIQUE source de
// hasard du moteur (les ex-Math.random y passent tous désormais).
export let _rngState: number | null = null; // null = Math.random (non seedé)
export function rng(): number {
  if (_rngState === null) return Math.random();
  let a = _rngState | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  _rngState = a;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function setSeed(seed: number): void { _rngState = (seed | 0) || 1; }
export function clearSeed() { _rngState = null; }
export function getSeedState() { return _rngState; }
export function setSeedState(s: number | null | undefined) { _rngState = (s === null || s === undefined) ? null : (s | 0); }
