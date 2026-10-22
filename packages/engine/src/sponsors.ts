// Contrats sponsors par paliers de réputation.

import { clamp, rand, randInt, pick } from "./utils";
import { tx } from "./text";
import type { CareerState, SponsorOffer, TransferOffer } from "./types";
import { BRAND, SPONSOR_BRANDS, SPONSOR_TIERS } from "@open-eleven/content";

// Sponsors par PALIERS de réputation (SPONSOR_TIERS, content) : au plus
// trois rendez-vous par carrière, jamais avant minAge, et plus aucun
// renouvellement périodique. s.sponsorTier = nombre de paliers déjà
// franchis. Si la réputation a sauté plusieurs caps d'un coup, on propose
// directement le plus haut atteint (pas deux écrans deux saisons de suite).
// Renvoie l'index du palier à proposer, ou -1. Aucun rng.
export function sponsorTierIdx(s: CareerState) {
  for (let i = SPONSOR_TIERS.length - 1; i >= (s.sponsorTier || 0); i--) {
    const t = SPONSOR_TIERS[i];
    if (s.rep >= t.minRep && s.age >= t.minAge && (s.peakOvr || 0) >= (t.minPeakOvr || 0)) return i;
  }
  return -1;
}

export function sponsorDealDue(s: CareerState) { return sponsorTierIdx(s) >= 0; }

// Titre et texte du palier à proposer (affichage) — null si rien n'est dû.
export function sponsorTierFor(s: CareerState) {
  const i = sponsorTierIdx(s);
  return i >= 0 ? { title: SPONSOR_TIERS[i].title, text: SPONSOR_TIERS[i].text } : null;
}

// Offres du palier, TIRÉES (marque au hasard, montants dans une
// fourchette). L'ordre des options est stable : l'appelant (UI ou
// replayRun) référence son choix par INDEX dans cette liste.
export function sponsorOffersFor(s: CareerState) {
  const idx = sponsorTierIdx(s);
  if (idx < 0) return [];
  const roll = (v: number | [number, number] | undefined) => (Array.isArray(v) ? randInt(v[0], v[1]) : v || 0);
  return SPONSOR_TIERS[idx].options.map((o) => ({
    id: o.id, tier: idx,
    label: `${o.labelBase} — ${pick(SPONSOR_BRANDS[o.brands])}`,
    desc: o.desc,
    mult: Math.round(rand(o.mult[0], o.mult[1]) * 100) / 100,
    repDelta: roll(o.repDelta),
    disciplineDelta: roll(o.disciplineDelta),
    money: o.money ? Math.round(rand(o.money[0], o.money[1]) * 100) / 100 : 0,
  }));
}

export function applySponsorDeal(s: CareerState, offer: SponsorOffer) {
  s.sponsorDeal = { id: offer.id, label: offer.label, mult: offer.mult };
  s.sponsorTier = offer.tier + 1;
  if (offer.repDelta) s.rep = clamp(s.rep + offer.repDelta, 0, 100);
  if (offer.disciplineDelta) s.discipline = clamp(s.discipline + offer.disciplineDelta, 0, 100);
  if (offer.money) s.money += offer.money;
  s.history.push({ age: s.age, text: tx(s, "sponsorSigned", { dealLabel: offer.label }), impact: 3 + offer.tier * 2 });
}
