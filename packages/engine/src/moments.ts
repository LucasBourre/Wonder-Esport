// Moments décisifs interactifs (finales, barrages, derbys…).

import type { MomentVariant } from "@open-eleven/content";
import { rng } from "./rng";
import { clamp, pick } from "./utils";
import { renderText } from "./text";
import { applyFx } from "./effects";
import { hasTrait } from "./player";
import type { CareerState, Chip, EventOption, KeyMoment } from "./types";
import { KEY_MOMENTS } from "@open-eleven/content";

// --- Moments décisifs (interactifs) -----------------------------------------
// Sélectionne la variante d'un moment décisif : pool par poste si
// disponible, sinon gk/field, sinon générique. Chaque pool peut être
// un tableau de scénarios (variété anti-répétition).
export function keyMomentFor(s: CareerState, momentId: string): MomentVariant | null {
  const variants = KEY_MOMENTS[momentId];
  if (!variants) return null;
  // Repli final sur "field" : une variante de poste oubliée renverrait sinon
  // un moment vide, et la carte décisive resterait bloquée (aucun bouton).
  let pool: MomentVariant | MomentVariant[] | undefined = variants[s.position.id]
    || (s.position.id === "gk" ? variants.gk : variants.field)
    || variants.any
    || variants.field;
  if (Array.isArray(pool)) pool = pick(pool);
  return pool || null;
}

export function keyMomentSuccess(s: CareerState, option: EventOption) {
  let p = option.base;
  p += s.position.id === "gk" ? (s.stats.m - 60) / 300 : (s.stats.t - 70) / 350;
  p += (s.form - 60) / 500;
  if (hasTrait(s, "clutch")) p += 0.08;
  return rng() < clamp(p, 0.15, 0.92);
}

// Applique un moment décisif générique : retourne { success, text, chips }.
export function playKeyMoment(s: CareerState, moment: KeyMoment, option: EventOption) {
  const success = keyMomentSuccess(s, option);
  const chips: Chip[] = [];
  if (success && option.repWin) chips.push(...applyFx(s, { rep: option.repWin }));
  if (!success && option.repFail) chips.push(...applyFx(s, { rep: option.repFail }));
  if (success && option.traitWin && !hasTrait(s, option.traitWin)) {
    chips.push(...applyFx(s, { trait: option.traitWin }));
  }
  // Beats scénarisés (mode Histoire) : drapeau posé selon le CHOIX (toujours),
  // et textes propres à l'option si fournis (sinon ceux du moment).
  if (option.flag) s.flags[option.flag] = true;
  const winTxt = option.winText || moment.winText;
  const failTxt = option.failText || moment.failText;
  return { success, text: renderText(s, success ? winTxt : failTxt), chips };
}
