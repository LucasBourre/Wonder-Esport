// Potentiel caché et trajectoire de carrière.

import type { Dict } from "@open-eleven/content";
import { clamp, rand, randInt, weightedRandom } from "./utils";
import type { CareerState, Profile, Tagged } from "./types";
import { BALANCE, TRAJECTORIES } from "@open-eleven/content";

// --- Potentiel caché & trajectoire -----------------------------------------
// NB : une entrée par id de ORIGINS. « prodige » manquait ici et dans
// ORIGIN_ACADEMY (oubli lors de l'ajout de cette 6e origine) : l'origine vendue
// comme « un cran au-dessus dès le départ » recevait donc un bonus de potentiel
// NUL et aucun intérêt des grands centres, contrairement à sa promesse.
export const ORIGIN_POT: Dict<number> = { formation: 1, sportif: 1, quartier: 2, futsal: 2, tardif: -2, prodige: 3 };

export function rollPotential(origin: Tagged, lifestyle?: Tagged, entourage?: Tagged) {
  let cap = 72 + randInt(-4, 14);
  cap += ORIGIN_POT[origin.id] || 0;
  cap += lifestyle ? lifestyle.potBonus : 0;
  if (entourage && entourage.id === "family") cap += 1;
  return clamp(cap, 68, 97);
}

export function potStars(potCap: number) {
  if (potCap <= 74) return 1;
  if (potCap <= 80) return 2;
  if (potCap <= 85) return 3;
  if (potCap <= 91) return 4;
  return 5;
}

// Probabilité qu'un profil naisse « talent générationnel » : influencée par
// les choix de création (origine, hygiène de vie, entourage) et la nation.
// Base faible, meilleur profil possible ~5 % (cf. BALANCE.prodigy*).
export function prodigyChance(profile: Pick<Profile, "nationality" | "origin" | "lifestyle" | "entourage">) {
  const b = BALANCE;
  let p = b.prodigyBase;
  p += b.prodigyOrigin[profile.origin.id] || 0;
  if (profile.lifestyle) p += b.prodigyLifestyle[profile.lifestyle.id] || 0;
  if (profile.entourage) p += b.prodigyEntourage[profile.entourage.id] || 0;
  p *= profile.nationality ? profile.nationality.weight : 1;
  return clamp(p, 0, b.prodigyChanceCap);
}

export function pickTrajectory(origin: Tagged) {
  return weightedRandom(TRAJECTORIES, (t) => {
    let w = t.w;
    if (origin.id === "tardif" && (t.id === "late" || t.id === "surge")) w *= 4;
    if (origin.id === "tardif" && (t.id === "early" || t.id === "flash")) w *= 0.2;
    return w;
  });
}

// Multiplicateur de progression selon la trajectoire et l'âge.
export function trajGrowthMult(s: CareerState) {
  const a = s.age;
  switch (s.trajectory.id) {
    case "steady": return a <= 25 ? 0.8 : 1.1;
    case "early": return a <= 21 ? 1.8 : a <= 25 ? 0.8 : 0.6;
    case "late": return a <= 22 ? 0.7 : a <= 29 ? 1.7 : 1;
    case "chaotic": return rand(0.4, 1.7);
    case "unstable": return 1.2;
    case "flash": return a <= 20 ? 1.9 : a <= 24 ? 0.5 : 0.3;
    case "surge": return a < s.sparkAge ? 0.75 : a <= s.sparkAge + 2 ? 2.1 : 1;
    default: return 1;
  }
}
