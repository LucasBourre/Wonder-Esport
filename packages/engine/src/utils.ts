// Utilitaires : bornes, tirages, niveaux et divisions, élisions.

import { rng } from "./rng";

// --- Utilitaires -----------------------------------------------------
export function clamp(v: number, min: number, max: number): number { return Math.max(min, Math.min(max, v)); }
export function rand(min: number, max: number): number { return min + rng() * (max - min); }
export function randInt(min: number, max: number): number { return Math.floor(rand(min, max + 1)); }
export function pick<T>(arr: T[]): T { return arr[Math.floor(rng() * arr.length)]; }
// Tire n éléments distincts (Fisher-Yates partiel). Consomme EXACTEMENT n appels
// à rng(), quel que soit le moteur JS.
// ⚠️ Remplace un ancien `[...pool].sort(() => rng() - 0.5)` : le nombre d'appels
// au comparateur d'un sort() dépend de l'implémentation (V8/TimSort ≠ SpiderMonkey
// ≠ JavaScriptCore), donc le déterminisme n'était PAS portable — un joueur Firefox
// voyait sa carrière recalculée différemment par le serveur (Deno/V8). En prime, le
// mélange par sort() est statistiquement biaisé, et coûtait ~2000 tirages par
// mercato sur un pool de 332 clubs contre 1 à 3 ici.
export function sampleN<T>(arr: T[], n: number): T[] {
  const a = arr.slice(), out: T[] = [];
  for (let i = 0; i < n && a.length; i++) out.push(a.splice(Math.floor(rng() * a.length), 1)[0]);
  return out;
}

// Comme sampleN, mais répartit les tirages sur des PAYS distincts avant
// d'en reprendre un second dans le même pays. Sans ça, un palier dominé par
// un seul pays (l'Angleterre, souvent, à l'élite) produisait régulièrement
// 2-3 offres du même pays d'affilée — statistiquement normal, mais perçu
// comme un manque de variété (retour joueur). N'a d'effet que si le pool
// couvre déjà plusieurs pays ; sinon se comporte comme sampleN.
//
// `countryWeight` (optionnel) : poids d'un pays, pour que les pays les plus
// plausibles sortent plus souvent ET en premier. L'ordre des pays est alors un
// tirage pondéré sans remise (Efraimidis-Spirakis : clé = u^(1/poids), tri
// décroissant). Sans lui, le comportement — et la consommation du hasard —
// restent ceux d'origine.
export function sampleDiverseByCountry<T extends { countryId: string }>(pool: T[], n: number, countryWeight?: (countryId: string) => number): T[] {
  const byCountry: Record<string, T[]> = {};
  pool.forEach((c) => { (byCountry[c.countryId] = byCountry[c.countryId] || []).push(c); });
  let countries = Object.keys(byCountry);
  if (countryWeight) {
    const key: Record<string, number> = {};
    for (const cid of countries) key[cid] = Math.pow(rng(), 1 / Math.max(0.0001, countryWeight(cid)));
    countries.sort((a, b) => key[b] - key[a]);
  } else {
    for (let i = countries.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = countries[i]; countries[i] = countries[j]; countries[j] = t; }
  }
  const out: T[] = [];
  // Une passe = un club de plus par pays encore disponible, dans l'ordre
  // (mélangé) ci-dessus. Consomme exactement 1 rng() par club RETENU, plus
  // le mélange initial des pays — pas un par club du pool entier.
  while (out.length < n && countries.length) {
    const next: string[] = [];
    for (const cid of countries) {
      if (out.length >= n) break;
      const g = byCountry[cid];
      out.push(g.splice(Math.floor(rng() * g.length), 1)[0]);
      if (g.length) next.push(cid);
    }
    countries = next;
  }
  return out;
}

export function weightedRandom<T>(items: T[], weightFn?: (item: T) => number): T {
  // Sans fonction de poids : le champ `weight`, à défaut `w`.
  const getW: (item: T) => number = weightFn || ((it: any) => (it.weight != null ? it.weight : it.w));
  const total = items.reduce((s, it) => s + getW(it), 0);
  let roll = rng() * total;
  for (const it of items) {
    roll -= getW(it);
    if (roll <= 0) return it;
  }
  return items[items.length - 1];
}

// Élision française : « de/le » deviennent « d'/l' » devant une voyelle (ou
// voyelle accentuée). Évite « le Aigle de Osaka » → « L'Aigle d'Osaka ».
export function frElide(w: unknown): boolean { return /^[aàâäeéèêëiîïoôöuùûüyAÀÂÄEÉÈÊËIÎÏOÔÖUÙÛÜY]/.test(String(w || "")); }
export function deOf(name: unknown): string {
  const w = String(name || "");
  if (/^Les /.test(w)) return "des " + w.slice(4); // « de Les Corts » → « des Corts »
  if (/^Le /.test(w)) return "du " + w.slice(3);   // « de Le Caire » → « du Caire »
  return (frElide(w) ? "d'" : "de ") + w;           // « de Paris » / « d'Amiens »
}
export function leOf(w: string): string { return (frElide(w) ? "L'" : "Le ") + w; } // « Le Balayeur » / « L'Aigle »

export function fmtMoney(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace(".", ",")} Md€`;
  if (m > 0 && m < 0.1) return `${Math.max(1, Math.round(m * 1000))} k€`;
  const v = m >= 10 ? Math.round(m) : Math.round(m * 10) / 10;
  return `${String(v).replace(".", ",")} M€`;
}
