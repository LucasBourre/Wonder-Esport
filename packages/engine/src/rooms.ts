// Mode salle : trophées de club partagés entre coéquipiers.

import { continentOf, countryOf, lvlOf } from "./clubs";
import type { CareerState } from "./types";

// Mode salle : crédite à CE joueur des trophées CLUB déjà remportés cette
// saison par un coéquipier de la même salle, quand SA PROPRE simulation
// locale ne les a pas tirés. Les carrières de la salle tournent chacune sur
// un RNG local indépendant (aucune vérification serveur, cf. rooms*.sql),
// mais la salle impose le MÊME club à tous : un titre gagné par l'un doit
// compter pour tous, sans quoi le palmarès de la salle paraît arbitraire.
// keys : sous-ensemble de ["league","cup","continental","continental2",
// "continental3","supercup"], déjà filtré par l'appelant (game.ts) pour ne
// garder que ce que CE joueur n'a pas déjà à son compte cette saison — les
// distinctions individuelles (Ballon d'Or, Soulier d'Or...) ne se
// partagent jamais, elles ne sont pas concernées par cette fonction.
export function creditClubTrophies(s: CareerState, keys: string[]) {
  if (!keys || !keys.length) return;
  const cont = continentOf(s.club.countryId) || "eu";
  const lvl = lvlOf(s, s.club);
  keys.forEach((k) => {
    if (k === "league") {
      s.trophies.league += 1;
      s.leagueTitlesDetail.push({ countryId: s.club.countryId, level: lvl, clubId: s.club.id, year: s.year });
    } else if (k === "cup") {
      s.trophies.cup += 1;
    } else if (k === "continental") {
      s.trophies.continental += 1;
      s.continentalDetail.push({ continent: cont, year: s.year });
    } else if (k === "continental2") {
      s.trophies.continental2 += 1;
      (s.continental2Detail = s.continental2Detail || []).push({ continent: cont, year: s.year });
    } else if (k === "continental3") {
      s.trophies.continental3 += 1;
      (s.continental3Detail = s.continental3Detail || []).push({ continent: cont, year: s.year });
    } else if (k === "supercup") {
      s.trophies.supercup += 1;
      (s.supercupDetail = s.supercupDetail || []).push({ continent: cont, year: s.year });
    }
  });
  // Reflété aussi dans l'historique saison par saison (onglet Parcours).
  if (s.seasons.length) {
    const last = s.seasons[s.seasons.length - 1];
    last.trophies = [...new Set([...(last.trophies || []), ...keys])];
  }
}
