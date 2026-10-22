// Formes des tables de contenu. Les tables qui n'apparaissent pas ici ne
// sont pas encore typées : leur forme est déduite de leur littéral.

export type LevelId = "regional" | "d4" | "d3" | "d2" | "d1" | "elite";
export type ContinentId = "eu" | "am" | "af" | "as" | "oc";
export type PositionId = "gk" | "def" | "mil" | "att";

export interface Level { name: string; short: string; rank: number; }

export interface Country {
  id: string;
  name: string;
  flag: string;
  img?: string;
  /** « de France », « du Brésil », « des Pays-Bas », « d'Allemagne ». */
  of: string;
  salaryMult: number;
  growthMult: number;
  mediaMult: number;
  contMult?: number;
  continent: ContinentId;
  /** Pétromonarchie du Golfe : salaires gonflés, visibilité réduite. */
  gulf?: boolean;
}

export interface Club {
  id: string;
  name: string;
  /** Niveau d'ORIGINE. Le niveau effectif d'une carrière se lit via lvlOf(). */
  level: LevelId;
  countryId: string;
  colors?: string;
  img?: string;
}

export interface Nationality {
  id: string;
  name: string;
  flag: string;
  img?: string;
  /** Force générale de la sélection (0 → 1). */
  weight: number;
  /** Force spécifique en Coupe du Monde, si elle diffère. */
  wcWeight?: number;
  homeCountryId: string;
  /** Pays où l'on se forme, pour les territoires sans championnat propre. */
  clubCountryId?: string;
}

export interface Position {
  id: PositionId;
  name: string;
  icon: string;
  goalRate: number;
  assistRate: number;
  desc?: string;
  [key: string]: any;
}

export interface Role { id: string; label: string; icon: string; pt: number; expect: number; desc: string; }

/** Effets d'une issue d'événement (cf. l'en-tête de events.ts pour le détail). */
export interface Fx { [key: string]: any; }

export interface EventOutcome { weight: number; text: string; fx?: Fx; }

export interface EventOption {
  id?: string;
  label: string;
  hint?: string;
  cond?: { [key: string]: any };
  outcomes?: EventOutcome[];
  [key: string]: any;
}

export interface GameEvent {
  id: string;
  cat?: string;
  icon?: string;
  /** Poids dans le tirage de l'événement de la saison. */
  w?: number;
  cond?: { [key: string]: any };
  text: string;
  options: EventOption[];
  /** false = peut revenir plusieurs fois dans une carrière. */
  once?: boolean;
  /** Rendez-vous à âge fixe : passe avant le tirage ordinaire. */
  priority?: boolean;
  /** Jamais tiré : seulement programmé par un autre événement. */
  scheduledOnly?: boolean;
}

/** Dictionnaire indexé par identifiant : toute clé de texte est valide en lecture. */
export type Dict<T> = Record<string, T>;

/** Une chose nommée et illustrée : coupe, compétition, distinction, trait… */
export interface Named { name: string; icon?: string; [key: string]: any; }

/** Ballon d'Or d'un continent : la clé du compteur de trophées, son nom, son icône. */
export interface Ballon { key: string; name: string; icon: string; }

/** Viviers de prénoms et de noms d'une nation. */
export interface NamePool { first: string[]; last: string[]; [key: string]: any; }

/** Jeux régionaux d'un continent. `yearMod` : année du cycle de quatre ans (année % 4). */
export interface RegionalGames { name: string; short: string; icon: string; yearMod: number; }

/** Variante (poste, situation) d'un moment décisif. */
export interface MomentVariant { title: string; [key: string]: any; }

/** Une offre d'un palier de sponsoring. Les montants en [min, max] sont tirés par le moteur. */
export interface SponsorOptionDef {
  id: string; brands: string; labelBase: string; desc: string;
  mult: [number, number];
  repDelta?: number | [number, number];
  disciplineDelta?: number | [number, number];
  money?: [number, number];
}
export interface SponsorTierDef {
  id: string; minRep: number; minAge: number; minPeakOvr?: number; title: string; text: string;
  options: SponsorOptionDef[];
}

/** Un palier de la sélection de jeunes (U16 → U23). */
export interface YouthTier {
  id: string; label: string; aMin: number; aMax: number; ovrNeed: number;
  repNeed?: number; u17?: boolean; tournament: string | null;
}

/** Gravité d'une blessure. `endChance` : risque de fin de carrière (graves seulement). */
export interface InjuryTier {
  id: string; w: number; min: number; max: number; mor: number; form: number; big: boolean;
  up?: boolean; interactive?: boolean; endChance?: number;
}
