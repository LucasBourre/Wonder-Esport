// Rival généré et comparaison.

import { rng } from "./rng";
import { pick } from "./utils";
import { rollPotential } from "./potential";
import { academyOffers } from "./academy";
import { newCareer } from "./career";
import { tx } from "./text";
import { pickEvent, optionEligible, resolveOption } from "./events";
import { resolveWcFinal } from "./international";
import { playSeason, resolveSeasonMoment } from "./season";
import { advanceYear } from "./offseason";
import { offersFor, loanOffersFor, applyLoan, transferWindow, applyTransfer, renewContract } from "./transfers";
import { computeCareerScore } from "./ending";
import { sponsorDealDue, sponsorOffersFor, applySponsorDeal } from "./sponsors";
import type { CareerState, Position, SeasonReport } from "./types";
import { BALANCE, CLUBS, CLUBS_BY_LEVEL, ENTOURAGES, LIFESTYLES, NATIONALITIES, ORIGINS, POSITIONS, RIVAL_NEWS_AHEAD, RIVAL_NEWS_BAD, RIVAL_NEWS_BEHIND, RIVAL_NEWS_GOOD } from "@open-eleven/content";

// --- Rival ------------------------------------------------------------------
// Le rival joue au même poste que le joueur quand il est fourni :
// une vraie rivalité se joue sur le même territoire.
export function newRival(forcedPosition?: Position) {
  const nat = pick(NATIONALITIES);
  const origin = pick(ORIGINS);
  const position = forcedPosition || pick(POSITIONS);
  const lifestyle = pick(LIFESTYLES);
  const entourage = pick(ENTOURAGES);
  const potCap = rollPotential(origin, lifestyle, entourage);
  const offers = academyOffers({ nationality: nat, origin, lifestyle, entourage, potCap });
  const start = offers.length ? pick(offers).club : pick(CLUBS_BY_LEVEL.regional);
  return newCareer({ nationality: nat, origin, position, lifestyle, entourage, potCap, club: start });
}

export function rivalSeason(r: CareerState) {
  if (r.careerEnded || r.retiring || r.age > BALANCE.ageMax) return null;
  const ev = pickEvent(r);
  if (ev) {
    const eligible = ev.options.filter((o) => optionEligible(r, o));
    const opt = pick(eligible.length ? eligible : ev.options);
    const res = resolveOption(r, opt);
    if (r.careerEnded) return null;
    if (res.outcome.fx && res.outcome.fx.transfer && !res.outcome.fx.transfer.direct) {
      const offers = offersFor(r, res.outcome.fx.transfer);
      if (offers.length && rng() < 0.7) applyTransfer(r, pick(offers));
    } else if (res.outcome.fx && res.outcome.fx.loan) {
      const offers = loanOffersFor(r);
      if (offers.length) applyLoan(r, pick(offers));
    }
  }
  if (r.age <= 18 && rng() < BALANCE.earlyEndChance) {
    r.careerEnded = true;
    r.careerEndReason = "injury";
    return null;
  }
  const report: SeasonReport = playSeason(r);
  if (report.wc && report.wc.finalPending) resolveWcFinal(r, report, null);
  while (report.pendingMoments.length) resolveSeasonMoment(r, report, report.pendingMoments.shift(), null);
  if (r.careerEnded) return report; // blessure fatale en cours de saison : le rival ne transfère/vieillit plus
  if (r.forcedLoanNext) {
    r.forcedLoanNext = false;
    const l = loanOffersFor(r);
    if (l.length) { applyLoan(r, pick(l)); advanceYear(r); return report; }
  }
  if (sponsorDealDue(r)) applySponsorDeal(r, pick(sponsorOffersFor(r)));
  const window = transferWindow(r, report);
  if (window && window.retire) return report; // vétéran sans club : r.retiring est posé
  if (window) {
    if (window.offers.length && (window.noStay || rng() < 0.6)) applyTransfer(r, pick(window.offers));
    else renewContract(r, window);
  }
  advanceYear(r);
  return report;
}

// diff (optionnel) : score du joueur − score du rival, pour les unes
// comparatives qui font vivre le duel de génération.
export function rivalNewsLine(r: CareerState, report: SeasonReport, diff?: number | null) {
  if (!report) return null;
  if (diff != null && Math.abs(diff) > 12 && rng() < 0.35) {
    const tpl = pick(diff >= 0 ? RIVAL_NEWS_AHEAD : RIVAL_NEWS_BEHIND);
    return tpl.replace(/\{rival\}/g, r.name);
  }
  const good = report.rating >= 7 || report.trophies.length > 0;
  const tpl = pick(good ? RIVAL_NEWS_GOOD : RIVAL_NEWS_BAD);
  return tpl.replace(/\{rival\}/g, r.name);
}

export function compareVerdict(s: CareerState, r: CareerState) {
  if (s.careerEnded) return tx(s, "verdictYouEnded", { rival: r.name });
  if (r.careerEnded) return tx(s, "verdictRivalEnded", { rival: r.name });
  const diff = computeCareerScore(s) - computeCareerScore(r);
  if (diff > 50) return tx(s, "verdictCrushing", { rival: r.name });
  if (diff > 18) return tx(s, "verdictClearWin", { rival: r.name });
  if (diff > -18) return tx(s, "verdictTight", { rival: r.name });
  if (diff > -50) return tx(s, "verdictBehind", { rival: r.name });
  return tx(s, "verdictCrushed", { rival: r.name });
}
