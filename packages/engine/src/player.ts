// Joueur : niveau général (OVR) et traits.

import type { CareerState } from "./types";

export function ovr(s: CareerState) {
  return Math.round(0.4 * s.stats.t + 0.25 * s.stats.p + 0.2 * s.stats.m + 0.15 * s.stats.c);
}

export function hasTrait(s: CareerState, id: string) { return s.traits.includes(id); }
