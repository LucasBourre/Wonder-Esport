// Contrats sponsors par paliers de réputation.

// --- Contrats sponsors (choix actif, cf. engine.sponsorOffersFor/applySponsorDeal) ---
// Remplacent l'ancien multiplicateur fixe (1.8) caché dans le calcul de
// revenus de playSeason (qui reste la valeur par défaut tant qu'aucun contrat
// n'est signé). Les bonus (réputation, discipline, prime) sont appliqués UNE
// SEULE FOIS à la signature, jamais chaque saison.
//
// TROIS PALIERS de carrière, pas un renouvellement périodique : un sponsor ne
// se présente que lorsque la RÉPUTATION franchit un cap (et jamais avant
// minAge — personne ne courtise un gamin de 16 ans au centre de formation).
// Retour joueur : l'écran revenait tous les 2-5 ans, dès la première saison,
// avec toujours les trois mêmes profils. Désormais trois rendez-vous au plus
// par carrière, chacun avec SES propres offres, et le contrat signé court
// jusqu'au palier suivant (aucune échéance).
// Les montants sont tirés dans une fourchette et la marque piochée au hasard.
// L'ORDRE des paliers et des options est lu par INDEX lors du rejeu
// (replayRun) : n'ajouter qu'à la fin, ne pas réordonner.
import type { Dict, SponsorTierDef } from "./types";

export const SPONSOR_BRANDS: Dict<string[]> = {
  cash: ["VoltEnergy", "Apex Finance", "Rapide Pay", "Cobra Sport", "Nova Bet", "Titan Capital"],
  image: ["Lumière Media", "Studio Icône", "Aura Beauté", "Prestige Mode", "Halo Style"],
  perf: ["PulseGear", "IronCore Nutrition", "MaxForm Training", "VitalEdge", "PeakLab"],
  kit: ["Strato", "Falcon Sport", "Kaiser", "Lynx", "Novara", "Torque"],
};

export const SPONSOR_TIERS: SponsorTierDef[] = [
  {
    id: "first", minRep: 30, minAge: 18, title: "Premier équipementier",
    text: "Votre nom commence à circuler. Pour la première fois, des équipementiers font le déplacement pour vous faire signer.",
    options: [
      { id: "first_bonus", brands: "cash", labelBase: "Prime à la signature", desc: "Un chèque tout de suite, un contrat modeste ensuite.", mult: [1.7, 2.1], money: [0.15, 0.3] },
      { id: "first_bet", brands: "kit", labelBase: "Marque montante", desc: "Rien à la signature, mais des revenus indexés sur votre ascension.", mult: [2.2, 2.8] },
      { id: "first_perf", brands: "perf", labelBase: "Équipementier technique", desc: "Peu d'argent, mais un suivi matériel et physique de haut niveau.", mult: [1.5, 1.9], disciplineDelta: [3, 6] },
    ],
  },
  {
    id: "national", minRep: 55, minAge: 18, title: "Visage national",
    text: "Vous êtes devenu une tête d'affiche du championnat. Les grandes enseignes du pays veulent votre visage sur leurs campagnes.",
    options: [
      { id: "nat_cash", brands: "cash", labelBase: "Contrat cash", desc: "Le maximum de revenus, sans contrepartie.", mult: [2.4, 3.2] },
      { id: "nat_image", brands: "image", labelBase: "Égérie", desc: "Moins de revenus, mais une campagne qui installe votre image.", mult: [1.7, 2.2], repDelta: [4, 8] },
      { id: "nat_perf", brands: "perf", labelBase: "Partenariat performance", desc: "Moins de revenus, mais un encadrement qui muscle votre discipline.", mult: [1.7, 2.2], disciplineDelta: [4, 8] },
    ],
  },
  {
    // minPeakOvr : la réputation seule ne suffit pas à rendre ce palier rare
    // (plus de la moitié des carrières finissent au-dessus de 85) — il faut
    // aussi avoir été un joueur de tout premier plan (≈ 1 carrière sur 10).
    id: "global", minRep: 85, minPeakOvr: 86, minAge: 18, title: "Icône mondiale",
    text: "Votre nom dépasse le football. Les multinationales se disputent un contrat qui vous suivra jusqu'à la fin de votre carrière.",
    options: [
      { id: "glob_life", brands: "cash", labelBase: "Contrat à vie", desc: "Une rente colossale et garantie, quoi qu'il arrive.", mult: [3.0, 4.0] },
      { id: "glob_own", brands: "image", labelBase: "Votre propre marque", desc: "Un pari : tout ou presque rien, selon ce que le public en fera.", mult: [1.4, 5.2] },
      { id: "glob_fund", brands: "perf", labelBase: "Fondation à votre nom", desc: "Des revenus sages, mais une image qui force le respect partout.", mult: [1.8, 2.3], repDelta: [6, 10] },
    ],
  },
];
