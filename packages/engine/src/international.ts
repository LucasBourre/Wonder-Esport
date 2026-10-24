// Sélection nationale : Mondial, continentale, Ligue des Sélections, Coupe arabe, JO, Jeux régionaux.

import type { Dict, RegionalGames } from "@open-eleven/content";
import { rng } from "./rng";
import { clamp, rand, randInt, pick, weightedRandom } from "./utils";
import { tx } from "./text";
import { keyMomentFor, playKeyMoment } from "./moments";
import { grantAward, rollBallon } from "./awards";
import { recheckObjective } from "./season";
import { continentOf, countryOf } from "./clubs";
import { ovr, hasTrait } from "./player";
import type { CareerState, KeyMoment, SeasonReport } from "./types";
import { playMatch, qualifiersFor } from "./qualifiers";
import { ARAB_CUP, ARAB_CUP_STAGES, ARAB_NATION_IDS, BALANCE, ENGINE_TEXT, GAMES_STAGES, NATIONALITIES, NATIONAL_CUPS, NATIONS_LEAGUE, NAT_NUMBERS, NL_STAGES, OLYMPIC_STAGES, REGIONAL_GAMES, STORIES, WC_STAGES, WC_STAGES_48, YOUTH_STAGES, YOUTH_TIERS, YOUTH_U17_CUPS } from "@open-eleven/content";

// --- Coupe du Monde -------------------------------------------------------
export function isWorldCupYear(year: number) { return year % 4 === 2; }

// Déroule le tournoi jusqu'à la finale éventuelle. Si la finale est
// atteinte, l'issue n'est PAS tirée ici : elle se joue dans un moment
// décisif (resolveWcFinal), interactif pour le joueur, auto pour le rival.
export function playWorldCup(s: CareerState) {
  // Finale scénarisée (mode Histoire) : la nation atteint la finale à coup sûr
  // l'année où le joueur a l'âge prévu, et le moment décisif de l'histoire
  // remplace la finale générique (cf. STORIES.*.wcFinal).
  const storyFinal = storyWcFinalFor(s);
  // wcWeight : force de la nation SPÉCIFIQUEMENT en Coupe du Monde (renseignée sur
  // les 212 nations, jusqu'ici jamais lue — on utilisait le poids générique). Ça
  // distingue les nations qui surperforment en Mondial de leur niveau courant.
  const natW = s.nationality.wcWeight != null ? s.nationality.wcWeight : s.nationality.weight;
  const playerBoost = 0.6 + (ovr(s) / 100) * 0.8 + (hasTrait(s, "clutch") ? 0.15 : 0) + (s.flags.wc_fresh ? 0.1 : 0);
  delete s.flags.wc_fresh;
  // Mondial au format 48 équipes (2026) : un tour de plus (seizièmes) → le
  // finaliste joue 8 matchs. WC_STAGES_48 est propre au Mondial.
  let stage = weightedRandom(WC_STAGES_48, (st) => {
    // Tri par force de la nation (façon classement FIFA) : les étapes profondes
    // sont pilotées par natWeight ÉLEVÉ À UNE PUISSANCE (pas de plancher), pour
    // qu'un petit pays n'atteigne quasiment jamais une finale de Mondial. Le
    // talent du joueur (playerBoost) ne pèse plus qu'à la marge : un crack ne
    // porte pas un minnow au sacre. Mondial = le plus sélectif (^2.5).
    if (st.id === "champion" || st.id === "final") return (st.baseW / 2) * Math.pow(natW, 2.5) * (0.6 + playerBoost * 0.5) * 4.6;
    if (st.id === "semi") return st.baseW * Math.pow(natW, 1.8) * (0.4 + playerBoost * 0.4) * 1.9;
    return st.baseW;
  });
  if (storyFinal) stage = WC_STAGES_48.find((st) => st.id === "final") || WC_STAGES_48.find((st) => st.id === "champion") || stage;

  const finalReached = !!storyFinal || stage.id === "champion" || stage.id === "final";
  const wc: any = {
    year: s.year,
    stage: finalReached ? "final" : stage.id,
    label: finalReached ? ENGINE_TEXT.wcInFinal : stage.label,
    text: finalReached
      ? ENGINE_TEXT.wcFinalText
      : stage.text,
    finalPending: finalReached,
    champion: false,
    goldenBall: false,
    // Les 48 qualifiés : les poules et les adversaires sont tirés parmi eux.
    field: qualifiersFor(s, "wc", s.year).qualified,
  };
  if (!finalReached) {
    if (stage.id === "semi") {
      // Battu en demie : le tournoi ne s'arrête pas là, il reste le match
      // pour la 3e place. Monter sur le podium adoucit la déception.
      wc.thirdPlace = playThirdPlace(natW, playerBoost);
      const won = wc.thirdPlace === "won";
      wc.label = won ? ENGINE_TEXT.thirdPlaceLabel : ENGINE_TEXT.fourthPlaceLabel;
      wc.text = won ? ENGINE_TEXT.wcThirdText : ENGINE_TEXT.wcFourthText;
      s.rep = clamp(s.rep + (won ? 5 : 4), 0, 100);
      s.moral = clamp(s.moral - (won ? 1 : 5), 5, 100);
      s.history.push({ age: s.age, text: tx(s, "wcStage", { stage: wc.label }), impact: won ? 10 : 8 });
    } else {
      s.moral = clamp(s.moral - 3, 5, 100);
    }
  }
  // 8 matchs pour le finaliste : poules 3 → 16es 4 → 8es 5 → quart 6 → demie 7 → finale 8.
  // Le demi-finaliste battu en joue 8 lui aussi (match pour la 3e place).
  const games = stage.id === "groups" ? 3 : stage.id === "r32" ? 4 : stage.id === "r16" ? 5 : stage.id === "quarter" ? 6 : 8;
  s.natTeam.caps += games;
  const wcGoals = Math.round(games * s.position.goalRate * (0.4 + s.stats.t / 150) * rand(0.5, 1.4));
  s.natTeam.goals += wcGoals;
  wc.games = games;
  wc.goals = wcGoals;
  if (finalReached) wc.moment = storyFinal || keyMomentFor(s, "wc_final");
  if (storyFinal) wc.storyFinal = true;
  noteNatRun(s, "wc", wc.stage, wc.thirdPlace);
  return wc;
}

// --- Championnat continental de sélection (Euro / Copa América / CAN) --------
// Pendant continental de la Coupe du Monde, les années paires HORS Mondial.
// Auto-résolu (la CDM reste le seul tournoi à finale interactive) : un pendant
// plus accessible mais moins prestigieux. Le continent vient de la nationalité.
export function isContinentalYear(year: number) { return year % 4 === 0; }

// --- Meilleur buteur d'un tournoi de sélection ------------------------------
// La distinction du Mondial existait déjà, mais n'était attribuée QUE dans
// resolveWcFinal : marquer sept buts et sortir en quart ne donnait rien. Elle
// est désormais évaluée au retour du tournoi, comme ses trois nouvelles
// sœurs. Seuil SEUL, aucun tirage — grantAward et applyFx sont purs, donc
// aucun hasard n'est consommé et aucune carrière existante ne change.
export const COMP_SCORER_AWARD: Dict<string> = { wc: "wc_top_scorer", cont: "cont_top_scorer", natl: "natl_top_scorer", olympic: "oly_top_scorer", arab: "arab_top_scorer", games: "games_top_scorer" };
export function noteCompScorer(s: CareerState, report: SeasonReport, comp: string, goals: number) {
  const seuil = (BALANCE.compScorerGoals || {})[comp];
  if (!seuil || !goals || goals < seuil) return;
  grantAward(s, report, COMP_SCORER_AWARD[comp]);
}

// --- Numéro de maillot en sélection ---------------------------------------
// DÉRIVÉ, jamais tiré au sort : appeler rng() ici décalerait tout le flux
// aléatoire et changerait chaque carrière pour une même graine — donc
// invaliderait les duels en attente. Un hachage du nom donne la même variété
// d'un joueur à l'autre, tout en restant stable pour une carrière donnée.
export const NUM_RANG: Dict<number> = { debut: 0, cadre: 1, star: 2 };
export function natNumberFor(s: CareerState) {
  const table = (typeof NAT_NUMBERS !== "undefined" && NAT_NUMBERS[s.position.id]) || null;
  if (!table) return null;
  const caps = (s.natTeam && s.natTeam.caps) || 0;
  const rang = s.rep >= 85 && caps >= 20 ? "star" : (s.rep >= 70 || caps >= 10) ? "cadre" : "debut";
  const pool = table[rang] || table.debut;
  const cle = (s.name || "") + "|" + s.nationality.id + "|" + s.position.id;
  let h = 0;
  for (let i = 0; i < cle.length; i++) h = (h * 31 + cle.charCodeAt(i)) >>> 0;
  return { number: pool[h % pool.length], rang };
}
// Le numéro ne PEUT que monter en prestige : décrocher le 10 puis le rendre
// après une saison moyenne serait vécu comme une punition arbitraire.
export function updateNatNumber(s: CareerState) {
  const r = natNumberFor(s);
  if (!r) return;
  const actuel = s.natTeam.numberRank;
  if (actuel == null || NUM_RANG[r.rang] > NUM_RANG[actuel]) {
    s.natTeam.number = r.number;
    s.natTeam.numberRank = r.rang;
  }
}

// --- Parcours en sélection -------------------------------------------------
// Table d'étapes de chaque compétition, dans l'ORDRE croissant de valeur :
// le rang d'un parcours, c'est son indice. On réutilise les tables du jeu
// plutôt que d'en dupliquer une, qui dériverait tôt ou tard.
export const NAT_STAGE_TABLE: Dict<string> = { wc: "WC_STAGES_48", cont: "WC_STAGES", natl: "NL_STAGES", olympic: "OLYMPIC_STAGES", arab: "ARAB_CUP_STAGES", games: "GAMES_STAGES" };
export function natStages(comp: string) {
  const t: Dict<{ id: string; label: string }[]> = { WC_STAGES_48: WC_STAGES_48, WC_STAGES: WC_STAGES, NL_STAGES: NL_STAGES, OLYMPIC_STAGES: OLYMPIC_STAGES, ARAB_CUP_STAGES: ARAB_CUP_STAGES, GAMES_STAGES: GAMES_STAGES };
  return t[NAT_STAGE_TABLE[comp]] || [];
}
// Une seule entrée par compétition et par année : la finale de Coupe du Monde
// se joue en carte interactive APRÈS coup et fait passer le stade à
// « champion » — on met alors l'entrée à jour au lieu d'en créer une seconde.
// `third` (optionnel) : issue du match pour la 3e place d'un demi-finaliste
// ("won" | "lost"). Le stade reste « semi » ; ce champ affine le libellé et
// départage deux demi-finales entre elles.
export function noteNatRun(s: CareerState, comp: string, stage: string, third?: string | null | undefined) {
  if (!stage) return;
  s.natRuns = s.natRuns || [];
  const dejaLa = s.natRuns.find((r) => r.comp === comp && r.year === s.year);
  if (dejaLa) { dejaLa.stage = stage; dejaLa.third = third || null; }
  else s.natRuns.push({ comp, year: s.year, stage, third: third || null });
}
// Match pour la 3e place : le demi-finaliste battu rejoue. Tirage simple,
// légèrement influencé par la force de la nation et le niveau du joueur.
export function playThirdPlace(natW: number, playerBoost: number) {
  return rng() < clamp(0.5 + (natW - 0.5) * 0.2 + (playerBoost - 1.2) * 0.25, 0.3, 0.7) ? "won" : "lost";
}
// Meilleur parcours par compétition, du plus prestigieux au moins. Utilisé
// par la fiche de fin de carrière.
export function bestNatRuns(s: CareerState) {
  const par: Dict<{ comp: string; year: number; stage: string; rang: number; fin: number; total: number; label: string }> = {};
  for (const r of (s.natRuns || [])) {
    const table = natStages(r.comp);
    const rang = table.findIndex((x) => x.id === r.stage);
    if (rang < 0) continue; // stade inconnu (table modifiée depuis) : on ignore
    // Le libellé vient de la table elle-même : pas de second jeu de textes à
    // tenir à jour côté présentation.
    // À stade égal, une 3e place gagnée l'emporte sur une demi-finale sèche
    // ou une 4e place.
    const fin = r.third === "won" ? 1 : 0;
    const label = r.third === "won" ? ENGINE_TEXT.thirdPlaceLabel : r.third === "lost" ? ENGINE_TEXT.fourthPlaceLabel : table[rang].label;
    if (!par[r.comp] || rang > par[r.comp].rang || (rang === par[r.comp].rang && fin > par[r.comp].fin))
      par[r.comp] = { comp: r.comp, year: r.year, stage: r.stage, rang, fin, total: table.length, label };
  }
  const ordre = ["wc", "cont", "natl", "arab", "olympic", "games"];
  return ordre.filter((c) => par[c]).map((c) => par[c]);
}

/** Tournois de sélection joués une année donnée, avec le stade atteint (historique saison par saison). */
export function natRunsOfYear(s: CareerState, year: number) {
  const ordre = ["wc", "cont", "natl", "arab", "olympic", "games"];
  return (s.natRuns || [])
    .filter((r) => r.year === year)
    .map((r) => {
      const stage = natStages(r.comp).find((x) => x.id === r.stage);
      if (r.stage === "dnq") return { comp: r.comp, label: ENGINE_TEXT.natDnqLabel }; // non qualifiés
      const label = r.third === "won" ? ENGINE_TEXT.thirdPlaceLabel : r.third === "lost" ? ENGINE_TEXT.fourthPlaceLabel : stage ? stage.label : "";
      return { comp: r.comp, label };
    })
    .filter((r) => r.label)
    .sort((a, b) => ordre.indexOf(a.comp) - ordre.indexOf(b.comp));
}

export function playContinental(s: CareerState, report: SeasonReport) {
  const continent = continentOf(s.nationality.homeCountryId) ?? "";
  const cup = NATIONAL_CUPS[continent];
  if (!cup) return null; // continent sans tournoi (ne devrait pas arriver : nationalités eu/am/af)
  const natW = s.nationality.weight;
  const playerBoost = 0.6 + (ovr(s) / 100) * 0.8 + (hasTrait(s, "clutch") ? 0.15 : 0);
  const stage = weightedRandom(WC_STAGES, (st) => {
    // Tri par force (cf. Mondial), mais un cran plus accessible : un titre
    // continental reste un exploit possible pour un outsider (Grèce 2004,
    // Zambie 2012) et un continent faible peut gagner SA coupe. Gating ^2.0.
    if (st.id === "champion") return st.baseW * Math.pow(natW, 2.0) * (0.6 + playerBoost * 0.5) * 2.4;
    if (st.id === "final") return st.baseW * Math.pow(natW, 2.0) * (0.5 + playerBoost * 0.45) * 2.1;
    if (st.id === "semi") return st.baseW * Math.pow(natW, 1.5) * (0.4 + playerBoost * 0.4) * 1.4;
    return st.baseW;
  });
  const games = stage.id === "groups" ? 3 : stage.id === "r16" ? 4 : stage.id === "quarter" ? 5 : stage.id === "semi" ? 6 : 7;
  s.natTeam.caps += games;
  const goals = Math.round(games * s.position.goalRate * (0.4 + s.stats.t / 150) * rand(0.5, 1.4));
  s.natTeam.goals += goals;
  const cont = {
    year: s.year, continent, cupName: cup.name, cupShort: cup.short, icon: cup.icon,
    stage: stage.id, label: stage.label, text: stage.text, games, goals, champion: stage.id === "champion",
    field: qualifiersFor(s, "cont", s.year).qualified, // les qualifiés du continent
  };
  if (stage.id === "champion") {
    s.trophies.contInt += 1;
    s.continentalNatDetail = s.continentalNatDetail || [];
    s.continentalNatDetail.push({ continent, year: s.year });
    cont.label = `CHAMPION ${cup.of.toUpperCase()}`;
    cont.text = cup.championText;
    s.rep = clamp(s.rep + 6, 0, 100);
    s.moral = clamp(s.moral + 10, 5, 100);
    s.money += 1;
    s.history.push({ age: s.age, text: tx(s, "contChampion", { cupOf: cup.of }), impact: 22 });
    if (!report.awards.includes("ballon_won")) rollBallon(s, report, 1.5); // coup de pouce Ballon d'Or (moindre que le Mondial)
    recheckObjective(s, report);
  } else if (stage.id === "final") {
    cont.label = "Finaliste";
    s.rep = clamp(s.rep + 3, 0, 100);
    s.moral = clamp(s.moral - 5, 5, 100);
    s.history.push({ age: s.age, text: tx(s, "contFinalist", { cupOf: cup.of }), impact: 9 });
  } else if (stage.id === "semi") {
    s.rep = clamp(s.rep + 2, 0, 100);
    s.history.push({ age: s.age, text: tx(s, "contSemi", { cupOf: cup.of }), impact: 6 });
  } else {
    s.moral = clamp(s.moral - 2, 5, 100);
  }
  noteNatRun(s, "cont", cont.stage);
  return cont;
}

// Ligue des Sélections : compétition EUROPÉENNE de sélections jouée les années
// libres (ni Mondial ni Euro). Trophée secondaire, récompenses moindres qu'un Euro.
export function isNationsLeagueYear(year: number) { return year % 4 === 1; }

// --- Ligue des Sélections : quatre divisions (A à D) ---------------------------------
// Une nation européenne commence dans la division de sa force (16 par division, D pour
// le reste), puis monte ou descend selon son groupe. Seule la Ligue A joue le trophée.
const NL_LEAGUES = ["A", "B", "C", "D"];
const euNationsByForce = () => NATIONALITIES.filter((n) => continentOf(n.homeCountryId) === "eu").sort((a, b) => b.weight - a.weight);
function nlLeagueOf(s: CareerState): string {
  if (!s.nlLeague) {
    const idx = euNationsByForce().findIndex((n) => n.id === s.nationality.id);
    s.nlLeague = NL_LEAGUES[Math.min(3, Math.floor(Math.max(0, idx) / 16))];
  }
  return s.nlLeague;
}

// Ligues B, C, D : un groupe de 4 (aller-retour), pour monter ou ne pas descendre.
function playLowerNationsLeague(s: CareerState, league: string) {
  const cup = NATIONS_LEAGUE;
  const L = NL_LEAGUES.indexOf(league);
  const all = euNationsByForce();
  const band = all.slice(L * 16, L === 3 ? all.length : L * 16 + 16).filter((n) => n.id !== s.nationality.id);
  const pool = band.length >= 3 ? band : all.filter((n) => n.id !== s.nationality.id);
  const opps: typeof pool = [];
  while (opps.length < 3 && opps.length < pool.length) {
    const n = pool[Math.floor(rng() * pool.length)];
    if (!opps.includes(n)) opps.push(n);
  }
  const playerBoost = 0.6 + (ovr(s) / 100) * 0.8 + (hasTrait(s, "clutch") ? 0.15 : 0);
  const teams = [{ id: s.nationality.id, w: s.nationality.weight * (0.75 + playerBoost * 0.2) }, ...opps.map((n) => ({ id: n.id, w: n.weight }))];
  const rows = new Map(teams.map((t) => [t.id, { id: t.id, pts: 0, gd: 0 }]));
  for (const a of teams) for (const b of teams) {
    if (a === b) continue;
    const [x, y] = playMatch(a.w, b.w);
    const ra = rows.get(a.id)!, rb = rows.get(b.id)!;
    ra.gd += x - y; rb.gd += y - x;
    if (x > y) ra.pts += 3; else if (y > x) rb.pts += 3; else { ra.pts += 1; rb.pts += 1; }
  }
  const table = [...rows.values()].sort((a, b) => b.pts - a.pts || b.gd - a.gd);
  const rank = table.findIndex((r) => r.id === s.nationality.id) + 1;
  const move = rank === 1 && L > 0 ? "up" : rank === table.length && L < 3 ? "down" : "stay";
  const next = move === "up" ? NL_LEAGUES[L - 1] : move === "down" ? NL_LEAGUES[L + 1] : league;
  s.nlLeague = next;
  const games = 6;
  s.natTeam.caps += games;
  const goals = Math.round(games * s.position.goalRate * (0.4 + s.stats.t / 150) * rand(0.5, 1.4));
  s.natTeam.goals += goals;
  if (move === "up") {
    s.rep = clamp(s.rep + 2, 0, 100);
    s.moral = clamp(s.moral + 5, 5, 100);
    s.history.push({ age: s.age, text: tx(s, "nlPromoted", { league: next }), impact: 6 });
  } else if (move === "down") {
    s.moral = clamp(s.moral - 4, 5, 100);
    s.history.push({ age: s.age, text: tx(s, "nlRelegated", { league: next }), impact: -4 });
  }
  noteNatRun(s, "natl", "group");
  return {
    year: s.year, cupName: cup.name, cupShort: cup.short, icon: cup.icon,
    stage: "group", games, goals, champion: false, league, move, table,
    label: rank === 1 ? tx(s, "nlLeagueLabelFirst", { league }) : tx(s, "nlLeagueLabel", { league, rank }),
    text: tx(s, move === "up" ? "nlTextUp" : move === "down" ? "nlTextDown" : "nlTextStay", { league: next, rank }),
  };
}

export function playNationsLeague(s: CareerState, report: SeasonReport) {
  const league = nlLeagueOf(s);
  if (league !== "A") return playLowerNationsLeague(s, league);
  const cup = NATIONS_LEAGUE;
  const natW = s.nationality.weight;
  const playerBoost = 0.6 + (ovr(s) / 100) * 0.8 + (hasTrait(s, "clutch") ? 0.15 : 0);
  const stage = weightedRandom(NL_STAGES, (st) => {
    // Ligue des Sélections (Europe) : même tri par force que le continental.
    if (st.id === "champion") return st.baseW * Math.pow(natW, 2.0) * (0.6 + playerBoost * 0.5) * 2.4;
    if (st.id === "final") return st.baseW * Math.pow(natW, 2.0) * (0.5 + playerBoost * 0.45) * 2.1;
    if (st.id === "final_four") return st.baseW * Math.pow(natW, 1.5) * (0.4 + playerBoost * 0.4) * 1.4;
    return st.baseW;
  });
  const games = stage.games;
  s.natTeam.caps += games;
  const goals = Math.round(games * s.position.goalRate * (0.4 + s.stats.t / 150) * rand(0.5, 1.4));
  s.natTeam.goals += goals;
  const nl: { league?: string; move?: string; [key: string]: any } = {
    year: s.year, cupName: cup.name, cupShort: cup.short, icon: cup.icon,
    stage: stage.id, label: stage.label, text: stage.text, games, goals, champion: stage.id === "champion",
  };
  if (stage.id === "champion") {
    s.trophies.natLeague += 1;
    s.natLeagueDetail = s.natLeagueDetail || [];
    s.natLeagueDetail.push({ year: s.year });
    nl.label = `VAINQUEUR ${cup.of.toUpperCase()}`;
    nl.text = cup.championText;
    s.rep = clamp(s.rep + 3, 0, 100);
    s.moral = clamp(s.moral + 7, 5, 100);
    s.money += 0.4;
    s.history.push({ age: s.age, text: tx(s, "nlWinner", { cupOf: cup.of }), impact: 12 });
    if (!report.awards.includes("ballon_won")) rollBallon(s, report, 0.6); // léger coup de pouce (moindre que l'Euro)
    recheckObjective(s, report);
  } else if (stage.id === "final") {
    nl.label = "Finaliste";
    s.rep = clamp(s.rep + 2, 0, 100);
    s.moral = clamp(s.moral - 3, 5, 100);
    s.history.push({ age: s.age, text: tx(s, "nlFinalist", { cupOf: cup.of }), impact: 6 });
  } else if (stage.id === "final_four") {
    s.rep = clamp(s.rep + 1, 0, 100);
    s.history.push({ age: s.age, text: tx(s, "nlSemi", { cupOf: cup.of }), impact: 4 });
  } else {
    s.moral = clamp(s.moral - 1, 5, 100);
    // Sortie dès la phase de ligue : une fois sur quatre, c'est la dernière place, et la descente en B.
    if (rng() < 0.25) {
      s.nlLeague = "B";
      nl.league = "A"; nl.move = "down";
      s.history.push({ age: s.age, text: tx(s, "nlRelegated", { league: "B" }), impact: -4 });
    }
  }
  if (!nl.league) { nl.league = "A"; nl.move = nl.move || "stay"; }
  noteNatRun(s, "natl", nl.stage);
  return nl;
}

// --- Jeux Olympiques (tournoi U23, années %4==3) ----------------------------
export function isOlympicYear(year: number) { return year % 4 === 3; }

export function playOlympics(s: CareerState, report: SeasonReport) {
  const natW = s.nationality.weight;
  const playerBoost = 0.6 + (ovr(s) / 100) * 0.8 + (hasTrait(s, "clutch") ? 0.15 : 0);
  const stage = weightedRandom(OLYMPIC_STAGES, (st) => {
    // Plus ouvert que le Mondial (tournoi U23, terre d'exploits) : gating ^1.6.
    if (st.id === "champion" || st.id === "final") return st.baseW * Math.pow(natW, 1.6) * (0.5 + playerBoost * 0.5) * 3.0;
    if (st.id === "semi") return st.baseW * Math.pow(natW, 1.3) * (0.4 + playerBoost * 0.4) * 1.8;
    return st.baseW;
  });
  // Demi-finale perdue : le bronze ne tombe plus tout seul, il se joue dans
  // le match pour la 3e place (un match de plus).
  const thirdPlace = stage.id === "semi" ? playThirdPlace(natW, playerBoost) : null;
  const games = stage.games + (thirdPlace ? 1 : 0);
  const goals = Math.round(games * s.position.goalRate * (0.4 + s.stats.t / 150) * rand(0.5, 1.4));
  s.youth = s.youth || { caps: 0, goals: 0, tiers: [] };
  s.youth.caps += games; // les JO (U23) comptent dans les sélections jeunes
  s.youth.goals += goals;
  // `overage` : le règlement olympique autorise trois joueurs de plus de 23 ans
  // par sélection. Sans le dire, une convocation à 26 ans dans un tournoi
  // annoncé « U23 » passe pour un bug — c'était remonté comme tel.
  const ol: any = { year: s.year, stage: stage.id, label: stage.label, text: stage.text, games, goals, icon: "🥇", cupName: ENGINE_TEXT.olyCupName, medal: null, overage: s.age >= 24 };
  if (stage.id === "champion") {
    s.trophies.olympic += 1; s.olympicMedals.gold += 1; ol.medal = "gold"; ol.label = ENGINE_TEXT.olyGoldLabel;
    s.rep = clamp(s.rep + 5, 0, 100); s.moral = clamp(s.moral + 9, 5, 100);
    s.history.push({ age: s.age, text: tx(s, "olyGold"), impact: 16 });
    if (!report.awards.includes("ballon_won")) rollBallon(s, report, 0.5); // petit coup de pouce Ballon d'Or
  } else if (stage.id === "final") {
    s.olympicMedals.silver += 1; ol.medal = "silver"; ol.label = ENGINE_TEXT.olySilverLabel;
    s.rep = clamp(s.rep + 3, 0, 100); s.moral = clamp(s.moral - 2, 5, 100);
    s.history.push({ age: s.age, text: tx(s, "olySilver"), impact: 9 });
  } else if (stage.id === "semi") {
    ol.thirdPlace = thirdPlace;
    if (thirdPlace === "won") {
      s.olympicMedals.bronze += 1; ol.medal = "bronze"; ol.label = ENGINE_TEXT.olyBronzeLabel;
      ol.text = ENGINE_TEXT.olyBronzeText;
      s.rep = clamp(s.rep + 2, 0, 100);
      s.history.push({ age: s.age, text: tx(s, "olyBronze"), impact: 7 });
    } else {
      ol.label = ENGINE_TEXT.fourthPlaceLabel;
      ol.text = ENGINE_TEXT.olyFourthText;
      s.rep = clamp(s.rep + 1, 0, 100);
      s.moral = clamp(s.moral - 4, 5, 100);
    }
  } else {
    s.moral = clamp(s.moral - 2, 5, 100);
  }
  noteNatRun(s, "olympic", ol.stage, ol.thirdPlace);
  return ol;
}

// --- Tournois de groupe : force relative -------------------------------------
// La force d'une nation, rapportée à la meilleure du groupe qui dispute le
// tournoi : le Maroc vaut 1 à la Coupe arabe, la Nouvelle-Zélande 0,6 aux Jeux du
// Pacifique. Avec la force absolue, les nations d'Océanie (au mieux 0,45) ne
// gagneraient jamais leurs propres Jeux. Aucun tirage : pure dérivation.
function groupStrength(natW: number, groupWeights: number[]) {
  const best = Math.max(0.01, ...groupWeights);
  return clamp(natW / best, BALANCE.groupStrengthFloor, 1);
}

// --- Coupe arabe (équipe A, nations de la Ligue arabe) -----------------------
// Disputée les années de Ligue des Sélections (%4==1) : cette compétition est
// réservée à l'Europe, donc libre pour les nations arabes d'Asie et d'Afrique.
export function isArabCupYear(year: number) { return year % 4 === 1; }
export function isArabNation(s: CareerState) { return ARAB_NATION_IDS.includes(s.nationality.id); }

export function playArabCup(s: CareerState, report: SeasonReport) {
  const cup = ARAB_CUP;
  const natW = groupStrength(s.nationality.weight, NATIONALITIES.filter((n) => ARAB_NATION_IDS.includes(n.id)).map((n) => n.weight));
  const playerBoost = 0.6 + (ovr(s) / 100) * 0.8 + (hasTrait(s, "clutch") ? 0.15 : 0);
  const stage = weightedRandom(ARAB_CUP_STAGES, (st) => {
    // Même tri par force que les autres tournois de sélection : le talent du
    // joueur n'est qu'un coup de pouce, la profondeur du parcours dit la nation.
    if (st.id === "champion") return st.baseW * Math.pow(natW, 1.8) * (0.6 + playerBoost * 0.5) * 2.1;
    if (st.id === "final") return st.baseW * Math.pow(natW, 1.8) * (0.5 + playerBoost * 0.45) * 2.1;
    if (st.id === "semi") return st.baseW * Math.pow(natW, 1.3) * (0.4 + playerBoost * 0.4) * 1.4;
    return st.baseW;
  });
  // Demi-finale perdue : match pour la 3ᵉ place, un match de plus.
  const thirdPlace = stage.id === "semi" ? playThirdPlace(natW, playerBoost) : null;
  const games = stage.games + (thirdPlace ? 1 : 0);
  s.natTeam.caps += games;
  const goals = Math.round(games * s.position.goalRate * (0.4 + s.stats.t / 150) * rand(0.5, 1.4));
  s.natTeam.goals += goals;
  const arab: any = {
    year: s.year, cupName: cup.name, cupShort: cup.short, icon: cup.icon,
    stage: stage.id, label: stage.label, text: stage.text, games, goals, champion: stage.id === "champion", thirdPlace: null,
  };
  if (stage.id === "champion") {
    s.trophies.arabCup = (s.trophies.arabCup || 0) + 1;
    arab.label = ENGINE_TEXT.arabWinnerLabel;
    arab.text = cup.championText;
    s.rep = clamp(s.rep + 4, 0, 100);
    s.moral = clamp(s.moral + 8, 5, 100);
    s.money += 0.6;
    s.history.push({ age: s.age, text: tx(s, "arabWinner"), impact: 14 });
    if (!report.awards.includes("ballon_won")) rollBallon(s, report, 0.8); // coup de pouce Ballon d'Or, moindre que l'Euro
    recheckObjective(s, report);
  } else if (stage.id === "final") {
    s.rep = clamp(s.rep + 2, 0, 100);
    s.moral = clamp(s.moral - 4, 5, 100);
    s.history.push({ age: s.age, text: tx(s, "arabFinalist"), impact: 7 });
  } else if (stage.id === "semi") {
    arab.thirdPlace = thirdPlace;
    const won = thirdPlace === "won";
    arab.label = won ? ENGINE_TEXT.thirdPlaceLabel : ENGINE_TEXT.fourthPlaceLabel;
    arab.text = won ? ENGINE_TEXT.arabThirdText : ENGINE_TEXT.arabFourthText;
    s.rep = clamp(s.rep + (won ? 2 : 1), 0, 100);
    if (!won) s.moral = clamp(s.moral - 3, 5, 100);
    s.history.push({ age: s.age, text: tx(s, "arabSemi"), impact: 5 });
  } else {
    s.moral = clamp(s.moral - 2, 5, 100);
  }
  noteNatRun(s, "arab", arab.stage, arab.thirdPlace);
  return arab;
}

// --- Jeux régionaux (Asie, Afrique, Amériques, Pacifique) --------------------
// Pendant continental des Jeux Olympiques : tournoi U23, médailles or / argent /
// bronze. Pas de Jeux pour l'Europe.
export function regionalGamesOf(s: CareerState) {
  const continent = continentOf(s.nationality.homeCountryId) ?? "";
  const def = REGIONAL_GAMES[continent];
  return def ? { continent, ...def } : null;
}

export function playRegionalGames(s: CareerState, report: SeasonReport, g: RegionalGames & { continent: string }) {
  const natW = groupStrength(s.nationality.weight,
    NATIONALITIES.filter((n) => continentOf(n.homeCountryId) === g.continent).map((n) => n.weight));
  const playerBoost = 0.6 + (ovr(s) / 100) * 0.8 + (hasTrait(s, "clutch") ? 0.15 : 0);
  const stage = weightedRandom(GAMES_STAGES, (st) => {
    // Tournoi régional de jeunes : plus ouvert que les Jeux Olympiques.
    if (st.id === "champion" || st.id === "final") return st.baseW * Math.pow(natW, 1.5) * (0.5 + playerBoost * 0.5) * 2.4;
    if (st.id === "semi") return st.baseW * Math.pow(natW, 1.2) * (0.4 + playerBoost * 0.4) * 1.6;
    return st.baseW;
  });
  const thirdPlace = stage.id === "semi" ? playThirdPlace(natW, playerBoost) : null;
  const games = stage.games + (thirdPlace ? 1 : 0);
  const goals = Math.round(games * s.position.goalRate * (0.4 + s.stats.t / 150) * rand(0.5, 1.4));
  s.youth = s.youth || { caps: 0, goals: 0, tiers: [] };
  s.youth.caps += games; // tournoi U23 : compte dans les sélections jeunes, comme les JO
  s.youth.goals += goals;
  s.gamesMedals = s.gamesMedals || { gold: 0, silver: 0, bronze: 0 };
  const vars = { games: g.name };
  // overage : trois joueurs de plus de 23 ans par sélection (cf. playOlympics).
  const res: any = { year: s.year, stage: stage.id, label: stage.label, text: stage.text, games, goals, icon: g.icon, cupName: g.name, medal: null, overage: s.age >= 24 };
  if (stage.id === "champion") {
    s.trophies.games = (s.trophies.games || 0) + 1; s.gamesMedals.gold += 1; res.medal = "gold"; res.label = ENGINE_TEXT.olyGoldLabel;
    s.rep = clamp(s.rep + 4, 0, 100); s.moral = clamp(s.moral + 8, 5, 100);
    s.history.push({ age: s.age, text: tx(s, "gamesGold", vars), impact: 12 });
    if (!report.awards.includes("ballon_won")) rollBallon(s, report, 0.3);
  } else if (stage.id === "final") {
    s.gamesMedals.silver += 1; res.medal = "silver"; res.label = ENGINE_TEXT.olySilverLabel;
    s.rep = clamp(s.rep + 2, 0, 100); s.moral = clamp(s.moral - 2, 5, 100);
    s.history.push({ age: s.age, text: tx(s, "gamesSilver", vars), impact: 7 });
  } else if (stage.id === "semi") {
    res.thirdPlace = thirdPlace;
    if (thirdPlace === "won") {
      s.gamesMedals.bronze += 1; res.medal = "bronze"; res.label = ENGINE_TEXT.olyBronzeLabel;
      res.text = ENGINE_TEXT.gamesBronzeText;
      s.rep = clamp(s.rep + 2, 0, 100);
      s.history.push({ age: s.age, text: tx(s, "gamesBronze", vars), impact: 5 });
    } else {
      res.label = ENGINE_TEXT.fourthPlaceLabel;
      res.text = ENGINE_TEXT.gamesFourthText;
      s.rep = clamp(s.rep + 1, 0, 100);
      s.moral = clamp(s.moral - 3, 5, 100);
    }
  } else {
    s.moral = clamp(s.moral - 2, 5, 100);
  }
  noteNatRun(s, "games", res.stage, res.thirdPlace);
  return res;
}

// Renvoie le moment de finale scénarisée si le joueur suit une histoire dont
// la finale de CDM tombe à son âge actuel (année de Mondial garantie).
export function storyWcFinalFor(s: CareerState) {
  if (!s.storyId || typeof STORIES === "undefined") return null;
  const story = STORIES.find((st) => st.id === s.storyId);
  if (story && story.wcFinal && s.age === story.wcFinal.age) return story.wcFinal;
  return null;
}

// Résout la finale de CDM. optionId null → choix aléatoire (rival, simu).
export function resolveWcFinal(s: CareerState, report: SeasonReport, optionId: string | null) {
  const wc = report.wc;
  const moment: KeyMoment = wc.moment;
  const option = moment.options.find((o) => o.id === optionId) || pick(moment.options);
  const res: any = playKeyMoment(s, moment, option);
  res.option = option;
  wc.finalPending = false;
  if (res.success) {
    s.momentWins += 1;
    if (option.id === "panenka") s.flags.panenka_final = true;
    wc.champion = true;
    wc.stage = "champion";
    noteNatRun(s, "wc", "champion"); // la finale s'est jouée APRÈS l'archivage
    wc.label = ENGINE_TEXT.wcChampionLabel;
    s.trophies.worldCup += 1;
    report.trophies.push("worldCup");
    s.rep = clamp(s.rep + 8, 0, 100);
    s.moral = clamp(s.moral + 12, 5, 100);
    s.money += 2;
    s.history.push({ age: s.age, text: tx(s, "wcChampion"), impact: 40 });
    // Distinctions du tournoi
    if (ovr(s) >= 85 && rng() < 0.55) {
      wc.goldenBall = true;
      grantAward(s, report, "wc_golden_ball");
    }
    // (Le meilleur buteur du Mondial est désormais attribué au retour de
    //  playWorldCup : il ne dépend plus d'avoir atteint la FINALE.)
    // Le sacre mondial rebat les cartes du Ballon d'Or de fin d'année
    if (!report.awards.includes("ballon_won")) rollBallon(s, report, 3 + (wc.goldenBall ? 2.5 : 0));
    recheckObjective(s, report); // « Ramener un trophée majeur » : le Mondial compte
  } else {
    wc.stage = "final";
    wc.label = "Finaliste";
    s.rep = clamp(s.rep + 4, 0, 100);
    s.moral = clamp(s.moral - 8, 5, 100);
    s.history.push({ age: s.age, text: tx(s, "wcFinalist"), impact: 10 });
  }
  return res;
}

// Sélections de jeunes (U16 → U23) : on gravit l'échelle selon l'âge, tant
// qu'on n'est pas passé chez les A, si le niveau suit. Chaque nouveau palier
// décroché : annonce + réputation, et — pour les grands tournois de jeunes —
// un résultat résumé en une ligne. Les caps jeunes sont comptés à part des A.
export function youthSelections(s: CareerState, report: SeasonReport) {
  if (s.natTeam.active || s.natTeam.retired || s.age > 23) return;
  s.youth = s.youth || { caps: 0, goals: 0, tiers: [] };
  const natW = s.nationality.weight;
  const drawStage = () => weightedRandom(YOUTH_STAGES, (x) =>
    x.id === "champion" ? x.baseW * (0.4 + natW * 1.6) :
    (x.id === "final" || x.id === "semi") ? x.baseW * (0.5 + natW * 1.0) : x.baseW);
  for (const tier of YOUTH_TIERS) {
    if (s.age < tier.aMin || s.age > tier.aMax || s.youth.tiers.includes(tier.id)) continue;
    const repNeed = tier.repNeed != null ? tier.repNeed : 18 + (tier.aMin - 15) * 4;
    if (ovr(s) < tier.ovrNeed || s.rep < repNeed) continue;
    s.youth.tiers.push(tier.id);
    s.flags.youth_int = true;
    s.youth.caps += randInt(3, 6);
    s.rep = clamp(s.rep + 2, 0, 100);
    report.lines.push({ text: tx(s, "lineYouthCall", { tier: tier.label }), impact: 5 });
    s.history.push({ age: s.age, text: tx(s, "youthCall", { tier: tier.label }), impact: 5 });
    if (tier.u17) {
      // Coupe continentale U17 (au nom du continent de la sélection), puis
      // Coupe du Monde U17 si la sélection atteint le dernier carré.
      s.youthTrophies = s.youthTrophies || { clubU17: 0, contU17: 0, wcU17: 0 };
      const cont = continentOf(s.nationality.homeCountryId) || "eu";
      const contName = YOUTH_U17_CUPS[cont] || YOUTH_U17_CUPS.eu;
      const st = drawStage();
      s.youth.caps += st.games;
      report.lines.push({ text: `🏆 ${contName} : ${st.label}.`, impact: st.champion ? 8 : 4 });
      if (st.champion) {
        s.youthTrophies.contU17 += 1;
        s.history.push({ age: s.age, text: tx(s, "youthWin", { tournament: contName }), impact: 9 });
      }
      if (st.champion || st.id === "final" || st.id === "semi") {
        const w = drawStage();
        s.youth.caps += w.games;
        report.lines.push({ text: `🌍 ${ENGINE_TEXT.youthU17World} : ${w.label}.`, impact: w.champion ? 10 : 5 });
        if (w.champion) {
          s.youthTrophies.wcU17 += 1;
          s.rep = clamp(s.rep + 3, 0, 100);
          s.history.push({ age: s.age, text: tx(s, "youthWin", { tournament: ENGINE_TEXT.youthU17World }), impact: 12 });
        }
      }
    } else if (tier.tournament) {
      const st = drawStage();
      s.youth.caps += st.games;
      report.lines.push({ text: `🏆 ${tier.tournament} : ${st.label}.`, impact: st.champion ? 8 : 4 });
      if (st.champion) s.history.push({ age: s.age, text: tx(s, "youthWin", { tournament: tier.tournament }), impact: 9 });
    }
    break; // un seul palier par saison
  }
}
