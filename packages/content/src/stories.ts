// Mode Histoire : carrières de légende à rejouer.

/* ============================================================
   MODE HISTOIRE — revivre des carrières de légende (masquées).
   Une histoire = un profil imposé + une époque (startYear) + des
   événements scriptés (beats → s.scheduled, événements marqués
   scheduledOnly dans EVENTS : jamais tirés au hasard) + un score
   de légende à battre (baseline, échelle computeCareerScore).
   Les légendes sont « inspirées de » et JAMAIS nommées : la
   reconnaissance fait partie du jeu (cf. reveal en fin de run).
   cost : prix en jetons (0 = offerte). Le reste du run est LIBRE.
   ============================================================ */
export const STORIES = [
  {
    id: "maestro",
    alias: "Le Maestro",
    icon: "🎩",
    cost: 0, // première histoire offerte : on goûte avant d'acheter
    era: "1988 → années 2000",
    startYear: 1988,
    teaser: "Un gamin des quartiers nord de Marseille, un toucher de balle venu d'ailleurs, un caractère volcanique. Parti d'un petit club de la Côte, il a tout gagné — avant la fin que le monde entier a vue. Réécrivez-la.",
    profile: { nationality: "fr", position: "mil", origin: "quartier" },
    potCap: 94,
    trajectory: "normal",
    baseline: 238,
    startClubId: "fr_cannes", // le club de la Côte où tout a commencé
    clubLevels: { fr_cannes: "d2", fr_bordeaux: "d1" }, // niveaux d'ÉPOQUE (fin 80s / 90s)
    beats: [
      { id: "ev_story_maestro_host", age: 16 },
      { id: "ev_story_maestro_clio", age: 18 },
      { id: "ev_story_maestro_roulette", age: 19 },
      { id: "ev_story_maestro_girondin", age: 20 },
      { id: "ev_story_maestro_bleus", age: 22 },
      { id: "ev_story_maestro_italy", age: 24 },
      { id: "ev_story_maestro_wc_home", age: 26 },
      { id: "ev_story_maestro_record", age: 29 },
      { id: "ev_story_maestro_volley", age: 30 },
    ],
    // Finale de la Coupe du Monde SCÉNARISÉE : le moteur garantit à la nation
    // d'atteindre la finale l'année où le joueur a cet âge (2006), et ce moment
    // décisif REMPLACE la finale générique (cf. engine.playWorldCup). C'est LE
    // choix du carton rouge — enfin joué là où il doit l'être.
    wcFinal: {
      age: 34,
      title: "FINALE DE LA COUPE DU MONDE",
      text: "Prolongation de la finale, vos toutes dernières minutes de footballeur. Le défenseur qui vous colle depuis une heure insulte votre famille — une fois de trop. Un milliard de téléspectateurs retiennent leur souffle.",
      options: [
        { id: "calm", label: "Garder votre calme — réécrire l'Histoire", hint: "Légendaire", base: 0.72, repWin: 6, traitWin: "zen", flag: "maestro_calm",
          winText: "Vous fixez l'horizon, respirez, et repartez jouer. Aux tirs au but, la délivrance : CHAMPION DU MONDE. L'Histoire retiendra le sacre — pas le geste que vous n'avez jamais commis.",
          failText: "Vous restez maître de vous jusqu'au bout. Les tirs au but, pourtant, tournent mal : finaliste. Mais vous quittez la scène mondiale la tête haute, à jamais digne." },
        { id: "headbutt", label: "Répondre, quoi qu'il en coûte", hint: "Le destin originel", base: 0.06, repFail: -6, flag: "maestro_redcard",
          winText: "Le coup part — carton rouge. Et pourtant, dans un dernier miracle, vos coéquipiers vous sacrent aux tirs au but. Champions… mais l'image du geste vous poursuivra pour toujours.",
          failText: "Le coup part — carton rouge direct. Vous quittez la pelouse sous les yeux du monde entier, et vos coéquipiers s'inclinent aux tirs au but. Le destin, encore, s'est répété." },
      ],
    },
    reveal: "Cette histoire s'inspire librement d'un maître à jouer des années 90-2000 : la famille d'accueil de la Côte, la voiture rouge du premier but, le doublé de la 63e minute pour sa première en Bleu, la serviette du transfert du siècle, la volée en finale européenne… et le coup de sang de trop, en mondovision. Vous connaissez la fin originale. Vous venez d'écrire la vôtre.",
    // Drapeaux posés par les beats : listés sur la fiche finale s'ils ont été vécus
    moments: {
      maestro_clio: "🚗 la voiture rouge du premier but",
      maestro_bleus: "🐓 le doublé de la 63e minute",
      maestro_napkin: "💎 la serviette du transfert du siècle",
      maestro_volley: "☄️ la volée du siècle",
      maestro_calm: "🧘 le calme de 2006, réécrit",
    },
  },
];
