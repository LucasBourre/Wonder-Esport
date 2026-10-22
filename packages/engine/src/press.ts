// Une de presse de fin de saison.

import { rng } from "./rng";
import { pick } from "./utils";
import type { CareerState, SeasonReport } from "./types";
import { HEADLINES } from "@open-eleven/content";

// --- Une de presse de fin de saison ---------------------------------------------
export function headlineFor(s: CareerState, report: SeasonReport) {
  // Une saison réellement PRODUCTIVE (buts + passes décisives) n'est jamais
  // une "année blanche", même si la note brute est modeste — typiquement un
  // jeune à l'OVR encore faible qui performe déjà. Le commentaire doit coller
  // aux statistiques affichées, pas à la seule note.
  const productive = report.matches >= 10 &&
    (report.goals + report.assists) >= report.matches * 0.33;
  // Un jeune (≤ 20 ans) n'est jamais « fini » : au lieu du banc ou du flop, la
  // presse le voit en pépite / futur prodige. On garde trophées & saison
  // exceptionnelle (ces unes-là restent méritées à tout âge).
  const young = s.age <= 20;
  let pool: string[] | null = null;
  if (report.injuryWeeks >= 12) pool = HEADLINES.injury;
  else if (young && (report.benched || report.rating <= 5.3)) pool = HEADLINES.prospect;
  else if (report.benched) pool = HEADLINES.benched;
  else if (report.trophies.length > 0) pool = HEADLINES.trophy;
  else if (report.rating >= 7.8) pool = HEADLINES.wonder;
  else if (productive && report.rating <= 5.3) pool = HEADLINES.solid; // productif mais mal noté → "valeur sûre", pas "flop"
  else if (report.rating <= 5.3) pool = HEADLINES.flop;
  else if ((report.rating >= 7 || productive) && rng() < 0.6) pool = HEADLINES.solid;
  if (!pool) return null;
  return pick(pool).replace(/\{name\}/g, s.name).replace(/\{club\}/g, s.club.name);
}
