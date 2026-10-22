// Clubs et pays : niveau effectif, divisions affichées, visibilité médiatique.

import { clamp } from "./utils";
import type { CareerState, Club, LevelId, Nationality } from "./types";
import { BALANCE, CLUBS, COUNTRIES, ENGINE_TEXT, LEVELS, LEVEL_ORDER } from "@open-eleven/content";

export function countryOf(countryId: string) { return COUNTRIES.find((c) => c.id === countryId); }
/** Le continent d'un pays, ou undefined si le pays est inconnu (ce que « (countryOf(id) || {}).continent » écrivait). */
export function continentOf(countryId: string | null | undefined): string | undefined {
  const country = countryId ? countryOf(countryId) : undefined;
  return country ? country.continent : undefined;
}

// Pays où l'on se FORME et où l'on joue « au pays ». Confondu avec le pays
// natal partout, sauf pour les territoires hors FIFA (Guadeloupe, Groenland,
// Zanzibar…) : ils ont une sélection mais aucun championnat professionnel,
// et leurs joueurs se forment dans l'État dont ils dépendent — exactement
// comme dans la réalité. D'où `clubCountryId`, qui ne touche ni au drapeau,
// ni au continent, ni à la sélection.
export function clubHomeOf(nat: Nationality) { return (nat && (nat.clubCountryId || nat.homeCountryId)) || null; }

export function levelRank(levelId: LevelId) { return LEVELS[levelId] ? LEVELS[levelId].rank : 0; }

// Étiquette de division RELATIVE à la nation. Le meilleur échelon d'un pays
// s'affiche « D1 », le suivant « D2 », etc. — même si sa FORCE réelle (level,
// qui pilote salaire/OVR/niveau) équivaut à un D3 voire un Régional des grands
// championnats. Chaque nation a ainsi sa propre pyramide à l'écran, sans rien
// changer à l'équilibrage. Les grands pays (top = élite) ne bougent pas.
export const _countryTopRank: Record<string, number> = {};

export function countryTopRank(countryId: string) {
  if (_countryTopRank[countryId] == null) {
    let top = 0;
    for (const c of CLUBS) if (c.countryId === countryId) top = Math.max(top, levelRank(c.level));
    _countryTopRank[countryId] = top;
  }
  return _countryTopRank[countryId];
}

// 5 crans non-élite : D1/D2/D3/D4 puis Régional (le palier "d4" ne compte
// qu'un cran de plus, inséré entre D3 et Régional — cf. LEVEL_ORDER).
export const _DIV_SHORTS = ["D1", "D2", "D3", "D4", ENGINE_TEXT.divRegional];

export function divShort(level: LevelId, countryId: string) {
  if (level === "elite") return ENGINE_TEXT.divElite; // l'élite reste distincte (grands pays)
  const baseIdx = { d1: 0, d2: 1, d3: 2, d4: 3, regional: 4 }[level];
  if (baseIdx == null) return LEVELS[level] ? LEVELS[level].short : level;
  const shift = Math.max(0, 4 - countryTopRank(countryId)); // 4 = rang de D1 (LEVELS.d1.rank)
  return _DIV_SHORTS[Math.max(0, baseIdx - shift)];
}

// Niveau EFFECTIF d'un club pour cette carrière : les montées/descentes
// vécues sont stockées dans s.clubLevels sans toucher aux données globales.
export function lvlOf(s: CareerState, club: Club) {
  return (s.clubLevels && s.clubLevels[club.id]) || club.level;
}

// Visibilité médiatique effective : les championnats du Golfe paient
// très cher mais exposent deux fois moins (gains de réputation réduits,
// Ballon d'Or hors de portée — cf. rollBallon).
// Visibilité médiatique : le niveau du club, MAIS AUSSI le pays. Un top club
// d'un championnat confidentiel n'a pas la même vitrine qu'un club anglais —
// c'est ce que porte country.mediaMult (renseigné sur les 212 pays et jusqu'ici
// jamais lu, comme growthMult, contMult et nationality.wcWeight).
export function visibilityOf(s: CareerState) {
  const base = BALANCE.mediaVisibility[lvlOf(s, s.club)];
  const country = countryOf(s.club.countryId);
  if (!country) return base;
  const m = (country.mediaMult != null ? country.mediaMult : 1) / BALANCE.countryMediaRef;
  return base * m * (country.gulf ? 0.5 : 1);
}

export function setClubLevel(s: CareerState, club: Club, levelId: LevelId) {
  s.clubLevels[club.id] = levelId;
}

export function shiftClubLevel(s: CareerState, club: Club, delta: number) {
  const idx = clamp(LEVEL_ORDER.indexOf(lvlOf(s, club)) + delta, 0, LEVEL_ORDER.length - 1);
  setClubLevel(s, club, LEVEL_ORDER[idx]);
  return LEVEL_ORDER[idx];
}
