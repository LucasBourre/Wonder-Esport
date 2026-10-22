// Profil du joueur : hygiène de vie, entourage, trajectoire, poste, archétype, origine, statut, traits.

import type { Dict, Named, Position, Role } from "./types";

// --- Hygiène de vie (choisie à la création) ---------------------------------
// fx appliqués au départ + potBonus sur le potentiel caché.
export const LIFESTYLES = [
  { id: "pro", name: "Hygiène de pro", icon: "🥗", desc: "Couché à 22h, diète stricte, zéro écart. Les coéquipiers se moquent, les recruteurs adorent.", fx: { dis: 18, form: 6, c: -4 }, potBonus: 2 },
  { id: "balance", name: "Équilibré", icon: "⚖️", desc: "Sérieux à l'entraînement, détendu en dehors. Ni moine, ni fêtard.", fx: { dis: 6, mor: 4 }, potBonus: 0 },
  { id: "street", name: "La belle vie", icon: "🎉", desc: "Les sorties, les potes, les réseaux. Le talent fera le reste… non ?", fx: { dis: -12, c: 8, mor: 6, form: -4 }, potBonus: -1 },
];

// --- Entourage (choisi à la création) ----------------------------------------
// academy : modificateurs de poids sur le niveau du centre de formation
// qui vous repère. flag : drapeau d'histoire posé dès le départ.
export const ENTOURAGES = [
  { id: "family", name: "Famille encadrante", icon: "👨‍👩‍👦", desc: "Des parents présents qui gèrent tout : contrats, école, équilibre. Ils filtrent les sollicitations : moins d'offres au mercato.", fx: { dis: 8, m: 4 }, academy: { d1: 6, elite: 2 } },
  { id: "shark", name: "Agent ambitieux", icon: "🦈", desc: "Un jeune agent aux dents longues vous a repéré. Il promet les sommets — et prend sa part. Il fait jouer la concurrence : plus d'offres au mercato.", fx: { rep: 6, dis: -4 }, academy: { elite: 10, d1: 2 }, flag: "shark_agent" },
  { id: "crew", name: "La bande du quartier", icon: "🤙", desc: "Vos amis d'enfance vous suivent partout. Fidèles, bruyants, incontrôlables.", fx: { c: 6, mor: 8, dis: -8 }, academy: { regional: 8, elite: -6 }, flag: "crew_entourage" },
];

// --- Trajectoires de carrière -------------------------------------------
// Tirée en secret à la création (biais selon l'origine), révélée sur la
// fiche finale. Module la vitesse de progression selon l'âge — c'est elle
// qui permet les phénomènes à 85 d'OVR à 20 ans comme les carrières en
// dents de scie. w = poids de tirage.
export const TRAJECTORIES = [
  { id: "normal", w: 26, label: "Progression classique", desc: "Une montée en puissance régulière." },
  { id: "steady", w: 13, label: "Lente mais sûre", desc: "Moins de fulgurances, plus de longévité." },
  { id: "early", w: 11, label: "Explosion précoce", desc: "Un talent qui brûle les étapes dès l'adolescence." },
  { id: "late", w: 12, label: "Révélation tardive", desc: "Le déclic arrive quand on ne l'attendait plus." },
  { id: "chaotic", w: 12, label: "Montagnes russes", desc: "Des saisons stratosphériques, d'autres à oublier." },
  { id: "unstable", w: 9, label: "Diamant instable", desc: "Un potentiel immense, un équilibre fragile." },
  { id: "flash", w: 8, label: "Météore", desc: "Phénoménal à 18 ans… puis le plafond arrive vite." },
  { id: "surge", w: 9, label: "Déclic fulgurant", desc: "Banal des années, puis une explosion soudaine." },
];

// --- Postes -------------------------------------------------------------
// goalRate/assistRate : rendement offensif de base par match (modulé
// par la technique et la forme dans engine).
export const POSITIONS: Position[] = [
  { id: "att", name: "Attaquant", icon: "⚡", goalRate: 0.6, assistRate: 0.18, desc: "Vivre et mourir pour le but. Les statistiques qui font les légendes… et les critiques quand elles se tarissent." },
  { id: "mil", name: "Milieu", icon: "🎩", goalRate: 0.24, assistRate: 0.4, desc: "Le chef d'orchestre. Moins de buts, plus de contrôle : c'est vous qui donnez le tempo du jeu." },
  { id: "def", name: "Défenseur", icon: "🛡️", goalRate: 0.08, assistRate: 0.09, desc: "L'art de l'ombre. Peu de gloire statistique, mais les grandes équipes se construisent derrière." },
  { id: "gk", name: "Gardien", icon: "🧤", goalRate: 0.004, assistRate: 0.01, desc: "Seul face à tous. Un poste ingrat où une carrière se joue sur des réflexes et des nerfs d'acier." },
];

// --- Archétypes de jeu (spécialisation choisie entre 18 et 21 ans) ----------
// mods : multiplicateurs appliqués chaque saison — goals/assists/cs
// (clean sheets), rating (delta sur la note), mGrowth (mental annuel bonus).
// Un archétype rend les statistiques crédibles : un renard des surfaces
// marque plus mais crée moins, un maestro distribue mais défend peu.
export const ARCHETYPES = [
  // Attaquants
  { id: "fox", pos: "att", name: "Renard des surfaces", icon: "🦊", desc: "Toujours au bon endroit. Le but avant tout, le reste ensuite.", effect: "+30% buts · −35% passes décisives", mods: { goals: 1.3, assists: 0.65 } },
  { id: "complete", pos: "att", name: "Attaquant complet", icon: "🎯", desc: "Marquer, faire marquer, peser sur chaque défense.", effect: "+8% buts · +15% passes · note +0,05", mods: { goals: 1.08, assists: 1.15, rating: 0.05 } },
  { id: "winger", pos: "att", name: "Ailier dribbleur", icon: "🌀", desc: "Le déséquilibre permanent : un contre un, encore et encore.", effect: "+40% passes décisives · −15% buts", mods: { goals: 0.85, assists: 1.4 } },
  { id: "false9", pos: "att", name: "Faux neuf", icon: "🎭", desc: "Décrocher, aimanter, libérer les autres : l'attaquant chef d'orchestre.", effect: "+55% passes · −25% buts · note +0,05", mods: { goals: 0.75, assists: 1.55, rating: 0.05 } },
  // Milieux
  { id: "anchor", pos: "mil", name: "Sentinelle", icon: "⚓", desc: "L'équilibre de toute l'équipe repose sur vos épaules.", effect: "note +0,15 · peu de stats offensives", mods: { goals: 0.5, assists: 0.75, rating: 0.15 } },
  { id: "b2b", pos: "mil", name: "Box-to-box", icon: "🚂", desc: "Douze kilomètres par match, présent dans les deux surfaces.", effect: "+25% buts · +5% passes", mods: { goals: 1.25, assists: 1.05 } },
  { id: "maestro", pos: "mil", name: "Maestro", icon: "🎼", desc: "Le tempo, les angles, la dernière passe : tout passe par vous.", effect: "+50% passes décisives · −20% buts", mods: { goals: 0.8, assists: 1.5 } },
  { id: "cam", pos: "mil", name: "Meneur offensif", icon: "✨", desc: "Entre les lignes, là où se décident les matchs.", effect: "+35% buts · +25% passes · note −0,05", mods: { goals: 1.35, assists: 1.25, rating: -0.05 } },
  // Défenseurs
  { id: "stopper", pos: "def", name: "Stoppeur", icon: "🧱", desc: "Le duel, l'impact, le kilomètre zéro de la défense.", effect: "note +0,10 · duels gagnés", mods: { goals: 0.9, assists: 0.7, rating: 0.1 } },
  { id: "libero", pos: "def", name: "Défenseur relanceur", icon: "🧭", desc: "La première passe qui casse les lignes part de vos pieds.", effect: "+50% passes décisives · note +0,05", mods: { assists: 1.5, rating: 0.05 } },
  { id: "wingback", pos: "def", name: "Latéral offensif", icon: "🛩️", desc: "Un couloir entier pour vous, de votre surface à la leur.", effect: "+90% passes · +30% buts · note −0,05", mods: { goals: 1.3, assists: 1.9, rating: -0.05 } },
  { id: "boss", pos: "def", name: "Patron de la défense", icon: "🛡️", desc: "La voix qui organise, replace et rassure toute une équipe.", effect: "note +0,15 · mental +1 par saison", mods: { rating: 0.15, mGrowth: 1 } },
  // Gardiens
  { id: "line", pos: "gk", name: "Gardien de ligne", icon: "🥅", desc: "Sur sa ligne, tout simplement infranchissable.", effect: "+15% clean sheets", mods: { cs: 1.15 } },
  { id: "sweeper", pos: "gk", name: "Gardien moderne", icon: "🧹", desc: "Onzième joueur de champ, première relance de l'équipe.", effect: "+5% clean sheets · relances décisives · note +0,05", mods: { cs: 1.05, assists: 2, rating: 0.05 } },
  { id: "aerial", pos: "gk", name: "Maître des airs", icon: "🪂", desc: "Chaque centre est une prise, chaque corner un soulagement.", effect: "+10% clean sheets · note +0,05", mods: { cs: 1.1, rating: 0.05 } },
  { id: "reflex", pos: "gk", name: "Gardien réflexes", icon: "⚡", desc: "L'arrêt impossible, votre spécialité.", effect: "+20% clean sheets", mods: { cs: 1.2 } },
];

// --- Origines sociales ----------------------------------------------------
// startStats : { t, p, m, c, rep } — visibles par le joueur cette fois.
export const ORIGINS = [
  { id: "formation", name: "Centre de formation classique", desc: "Un parcours académique, encadré et rigoureux depuis le plus jeune âge.", startStats: { t: 56, p: 54, m: 50, c: 42, rep: 18 } },
  { id: "sportif", name: "Fils de sportif pro", desc: "Un nom qui ouvre des portes, et une pression qui ne vous quitte jamais.", startStats: { t: 52, p: 55, m: 44, c: 55, rep: 32 } },
  { id: "quartier", name: "Quartier populaire", desc: "Tout appris dans la rue et sur des terrains vagues, à la dure.", startStats: { t: 60, p: 52, m: 58, c: 45, rep: 10 } },
  { id: "futsal", name: "Prodige du futsal", desc: "Des pieds en or forgés en salle. Le grand terrain reste à apprivoiser.", startStats: { t: 64, p: 42, m: 48, c: 46, rep: 14 } },
  { id: "tardif", name: "Révélé sur le tard", desc: "Personne ne croyait en vous. Le physique et la rage comme seuls bagages.", startStats: { t: 47, p: 60, m: 62, c: 38, rep: 5 } },
  { id: "prodige", name: "Prodige du foot", desc: "Un talent hors norme repéré très jeune : un cran au-dessus des autres dès le départ, mais l'attente qui pèse sur vos épaules est immense.", startStats: { t: 62, p: 56, m: 56, c: 50, rep: 26 } },
];

// --- Statut au club (rôle) ------------------------------------------
// Cran de statut vis-à-vis du coach, du plus faible au plus fort. `pt` = temps
// de jeu de base (ancre) ; `expect` = note de saison à tenir pour garder le poste.
// L'ordre du tableau EST le rang (index 0→4) ; s.role stocke cet index.
// « Espoir » est réservé aux JEUNES (≤ ROLE_ESPOIR_MAX_AGE) : passé cet âge on
// n'est plus un pari sur l'avenir, le plancher devient « Sporadique ».
export const ROLES: Role[] = [
  // `expect` monte franchement dans le HAUT de l'échelle : avec des attentes trop
  // basses partout, tout le monde cliquetait vers Titulaire et s'y verrouillait
  // (67 % des saisons mesurées) — le système à 5 crans n'en avait plus qu'un. Le bas
  // reste clément (un remplaçant ne doit pas être puni d'être remplaçant).
  { id: "espoir", label: "Espoir", icon: "🌱", pt: 0.12, expect: 5.0, desc: "Un pari sur l'avenir : peu de minutes, mais tu apprends au haut niveau." },
  { id: "sporadique", label: "Sporadique", icon: "🔸", pt: 0.30, expect: 5.5, desc: "Utilisé au compte-gouttes, souvent sur le banc." },
  { id: "rotation", label: "Rotation", icon: "🔄", pt: 0.52, expect: 6.0, desc: "Dans la rotation : environ une titularisation sur deux." },
  { id: "important", label: "Important", icon: "⭐", pt: 0.74, expect: 6.4, desc: "Cadre de la rotation, presque toujours sur la feuille." },
  { id: "titulaire", label: "Titulaire", icon: "👑", pt: 0.93, expect: 6.7, desc: "Indiscutable : tu joues, mais on attend beaucoup de toi." },
];

export const ROLE_ESPOIR_MAX_AGE = 20; // au-delà, plancher = Sporadique (index 1)

// --- Entraîneurs (noms générés) ---------------------------------------------
export const COACH_NAMES = [
  "R. Falcone", "J. Van Dael", "M. Herrera", "P. Leroy", "K. Adeyemi",
  "S. Novotný", "A. Guimarães", "T. Eriksson", "D. Marchetti", "H. Weiss",
  "L. Fontaine", "C. Ferraro", "O. Sørensen", "B. Quintana", "G. Marlow",
];

// --- Traits de personnalité --------------------------------------------------
export const TRAITS: Dict<Named> = {
  clutch: { name: "Sang froid", icon: "🧊", desc: "Décisif dans les grands rendez-vous." },
  showman: { name: "Showman", icon: "🎭", desc: "La foule vous adore, les caméras aussi." },
  leader: { name: "Leader né", icon: "🗣️", desc: "Le vestiaire vous suit les yeux fermés." },
  ironman: { name: "Increvable", icon: "🦾", desc: "Un corps qui encaisse tout." },
  glass: { name: "Verre fêlé", icon: "🩼", desc: "Votre corps vous lâche trop souvent." },
  mercenary: { name: "Mercenaire", icon: "🪙", desc: "L'argent d'abord, le cœur ensuite." },
  loyal: { name: "Cœur de club", icon: "❤️", desc: "Fidèle envers et contre tout." },
  genius: { name: "Génie précoce", icon: "✨", desc: "Un talent qui saute aux yeux." },
  party: { name: "Fêtard", icon: "🥂", desc: "Les nuits sont longues, les matins difficiles." },
  zen: { name: "Zen", icon: "🧘", desc: "Imperturbable, quoi qu'il arrive." },
};
