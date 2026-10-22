// Récompenses individuelles, Supercoupe et Ballon d'Or.

import { rng } from "./rng";
import { clamp, randInt } from "./utils";
import { tx } from "./text";
import { applyFx } from "./effects";
import { continentOf, countryOf, lvlOf } from "./clubs";
import { ovr, hasTrait } from "./player";
import type { CareerState, SeasonReport } from "./types";
import { AWARDS, BALANCE, CONTINENTAL_BALLON, CONTINENTAL_SUPERCUP } from "@open-eleven/content";

// --- Récompenses individuelles ----------------------------------------------
export function grantAward(s: CareerState, report: SeasonReport, id: string) {
  if (report.awards.includes(id)) return;
  const award = AWARDS[id];
  if (!award) return;
  applyFx(s, award.fx || {});
  report.awards.push(id);
  s.awardCounts[id] = (s.awardCounts[id] || 0) + 1;
  if (["league_mvp", "wc_golden_ball", "cl_mvp"].includes(id)) {
    s.history.push({ age: s.age, text: tx(s, "award", { icon: award.icon, awardName: award.name }), impact: 12 });
  }
}

export function rollSeasonAwards(s: CareerState, report: SeasonReport) {
  const lvl = lvlOf(s, s.club);
  const isTop = lvl === "elite" || lvl === "d1";
  const r = report.rating;
  if (isTop) {
    if (r >= 7.9 && rng() < 0.65) grantAward(s, report, "league_mvp");
    else if (r >= 7.5 && s.age <= 21 && rng() < 0.6) grantAward(s, report, "young_star");
    if (report.assists >= 14 && rng() < 0.5) grantAward(s, report, "top_assist");
    if (r >= 7.3 && rng() < 0.6) grantAward(s, report, "team_of_season");
    if (s.position.id === "gk" && report.cleanSheets >= 17 && rng() < 0.5) grantAward(s, report, "golden_glove");
    if (!s.flags.revelation_won && r >= 7.4 && s.age <= 22) {
      s.flags.revelation_won = true;
      grantAward(s, report, "revelation");
    }
  }
  if (report.trophies.includes("continental") && r >= 7.5 && rng() < 0.5) grantAward(s, report, "cl_mvp");
  // Légende du club : longévité + statut au même endroit
  if (!s.flags.club_legend_won && s.rep >= 70) {
    const seasonsHere = s.seasons.filter((se) => se.clubName === s.club.name).length;
    if (seasonsHere >= 7) {
      s.flags.club_legend_won = true;
      grantAward(s, report, "club_legend");
    }
  }
}

// --- Supercoupe continentale (C1 vs C2) -----------------------------------------
// Tirée juste après un sacre C1 OU C2 : le vainqueur y affronte le tenant de
// l'autre coupe (adversaire abstrait, aucun club simulé — juste un tirage
// pondéré, comme la Supercoupe de l'UEFA joue le vainqueur LDC contre celui
// d'Europa League). N'existe pas en Océanie (pas de C2, cf. CONTINENTAL_SUPERCUP).
export function rollSupercup(s: CareerState, report: SeasonReport, continent: string) {
  const cup = CONTINENTAL_SUPERCUP[continent];
  if (!cup) return;
  if (rng() > BALANCE.supercupChance) return;
  if (rng() < BALANCE.supercupWinChance) {
    s.trophies.supercup = (s.trophies.supercup || 0) + 1;
    report.trophies.push("supercup");
    (s.supercupDetail = s.supercupDetail || []).push({ continent, year: s.year });
    s.money += 0.3;
    s.rep = clamp(s.rep + 3, 0, 100);
    s.moral = clamp(s.moral + 6, 5, 100);
    s.history.push({ age: s.age, text: tx(s, "supercupWin", { cupName: cup.name }), impact: 8 });
  } else {
    s.moral = clamp(s.moral - 2, 5, 100);
    s.history.push({ age: s.age, text: tx(s, "supercupLoss", { cupName: cup.name }), impact: -2 });
  }
}

// --- Ballon d'Or (modèle à points de saison + classement top 30) ---------------
// extraPts : points supplémentaires injectés après coup (sacre mondial).
// Si la saison ne suffit pas pour le sacre, elle peut valoir une place
// dans le classement (top 30) — uniquement quand c'est crédible.
export function rollBallon(s: CareerState, report: SeasonReport, extraPts: number) {
  if (report.awards.includes("ballon_won")) return false;
  const lvl = lvlOf(s, s.club);
  if (lvl !== "elite" && lvl !== "d1") return false;
  // Loin des radars européens, ni sacre ni classement : le prix de l'exil doré
  if ((countryOf(s.club.countryId) || {}).gulf) return false;

  // Points de saison (communs au sacre et au classement)
  let pts = (report.rating - 7) * 2.2 + (extraPts || 0);
  if (report.trophies.includes("continental")) pts += report.continentalContinent === "eu" ? 2.2 : 0.8;
  if (report.trophies.includes("continental2")) pts += 0.7; // Trophée continental (C3 : aucun poids Ballon)
  if (report.trophies.includes("worldCup") && !extraPts) pts += 3;
  if (report.trophies.includes("league")) pts += 1.2;
  if (report.trophies.includes("cup")) pts += 0.4;
  if (report.trophies.includes("goldenBoot")) pts += 1.5;
  for (const id of report.awards) pts += (AWARDS[id] && AWARDS[id].ballonPts) || 0;
  if (s.rep >= 85) pts += 0.8;
  else if (s.rep >= 75) pts += 0.4;
  if (lvl === "elite") pts += 0.6;
  if (hasTrait(s, "clutch")) pts += 0.3;

  // Sacre : réservé aux saisons vraiment exceptionnelles
  if (ovr(s) >= BALANCE.ballonMinOvr && s.rep >= BALANCE.ballonMinRep && report.rating >= 7.2) {
    const count = s.trophies.ballon;
    const momentum = count === 0 ? 1 : count <= 2 ? BALANCE.ballonMomentum : BALANCE.ballonDynasty;
    const chance = clamp((pts - BALANCE.ballonPtsFloor) * BALANCE.ballonSlope, 0, BALANCE.ballonCap) * s.nationality.weight * momentum;
    if (rng() < chance) {
      s.trophies.ballon += 1;
      report.trophies.push("ballon");
      report.awards.push("ballon_won");
      report.ballonRank = 1;
      s.bestBallonRank = 1;
      s.rep = clamp(s.rep + 8, 0, 100);
      s.money += 1.5;
      s.history.push({ age: s.age, text: tx(s, "ballon"), impact: 30 });
      if (s.age <= 23) s.flags.early_ballon = true;
      return true;
    }
  }

  // Classement top 30 : grande saison exigée, cohérence stricte —
  // défenseurs/gardiens et championnats moins huppés classés plus bas,
  // sauf saison hors norme.
  if (report.rating >= 7 && ovr(s) >= 78 && s.rep >= 55 && pts >= 2.2) {
    let rankPts = pts;
    if ((s.position.id === "def" || s.position.id === "gk") && report.rating < 8) rankPts -= 1.2;
    if (lvl === "d1") rankPts -= 0.8;
    let rank;
    if (rankPts >= 8) rank = randInt(2, 3);
    else if (rankPts >= 6.5) rank = randInt(2, 5);
    else if (rankPts >= 5) rank = randInt(4, 10);
    else if (rankPts >= 3.5) rank = randInt(8, 20);
    else rank = randInt(15, 30);
    report.ballonRank = rank;
    if (!s.bestBallonRank || rank < s.bestBallonRank) s.bestBallonRank = rank;
    if (rank <= 10) s.rep = clamp(s.rep + 2, 0, 100);
    if (rank <= 3) s.history.push({ age: s.age, text: tx(s, "ballonPodium", { rank }), impact: 12 });
  }
  return false;
}

// Ballon d'Or continental (Asie/Afrique/Océanie) : distinction PARALLÈLE au
// Ballon d'Or mondial ci-dessus, pas un lot de consolation qui l'exclurait —
// volontairement PAS gardée par "ballon_won" : une saison assez historique
// peut décrocher les deux la même année (le vainqueur du Ballon d'Or mondial
// est de facto le meilleur joueur de son propre continent). Pas de version
// Europe : le Ballon d'Or classique en tient déjà lieu pour les joueurs
// européens. Barre plus basse que le mondial (récompense continentale, pas
// planétaire) mais même exigence de niveau (élite/D1) et même unicité par
// saison via son propre drapeau report.awards.
export function rollContinentalBallon(s: CareerState, report: SeasonReport, extraPts: number) {
  if (report.awards.includes("cballon_won")) return false;
  const info = CONTINENTAL_BALLON[continentOf(s.nationality.homeCountryId) ?? ""];
  if (!info) return false;
  const lvl = lvlOf(s, s.club);
  if (lvl !== "elite" && lvl !== "d1") return false;

  let pts = (report.rating - 6.6) * 2.2 + (extraPts || 0);
  if (report.trophies.includes("continental")) pts += 1.6;
  if (report.trophies.includes("continental2") || report.trophies.includes("continental3")) pts += 0.7;
  if (report.trophies.includes("worldCup") && !extraPts) pts += 2.2;
  if (report.trophies.includes("league")) pts += 1.2;
  if (report.trophies.includes("cup")) pts += 0.4;
  if (report.trophies.includes("goldenBoot")) pts += 1.5;
  for (const id of report.awards) pts += (AWARDS[id] && AWARDS[id].ballonPts) || 0;
  if (s.rep >= 80) pts += 0.6;
  if (hasTrait(s, "clutch")) pts += 0.3;

  if (ovr(s) >= BALANCE.ballonMinOvr - 5 && s.rep >= BALANCE.ballonMinRep - 15 && report.rating >= 6.9) {
    const count = s.trophies[info.key] || 0;
    const momentum = count === 0 ? 1 : count <= 2 ? BALANCE.ballonMomentum : BALANCE.ballonDynasty;
    const chance = clamp((pts - BALANCE.ballonContPtsFloor) * BALANCE.ballonContSlope, 0, BALANCE.ballonContCap) * momentum;
    if (rng() < chance) {
      s.trophies[info.key] = (s.trophies[info.key] || 0) + 1;
      report.trophies.push(info.key);
      report.awards.push("cballon_won");
      s.rep = clamp(s.rep + 5, 0, 100);
      s.money += 0.7;
      s.history.push({ age: s.age, text: tx(s, "continentalBallon", { name: info.name }), impact: 18 });
      return true;
    }
  }
  return false;
}
