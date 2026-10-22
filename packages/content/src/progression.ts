// Quêtes, badges, avantages de la boutique et séries.

/* ============================================================
   BADGES — méta-progression entre les parties (localStorage).
   hint : indice montré tant que le badge est verrouillé.
   desc : condition exacte, révélée après déblocage (avec le
   contexte d'obtention mémorisé par game.ts).
   secret : ni nom ni indice avant déblocage — pur mystère.
   cat : catégorie d'affichage (cf. BADGE_CATS). Débloquer tous
   les autres badges révèle le Graal (badge "platine").
   ============================================================ */
/* ============================================================
   QUÊTES — rétention & défis. Trois niveaux d'engagement :
   • DAILY_QUESTS   : pool réparti en 3 paliers de difficulté
     (tier 1 facile → 3 difficile). Chaque jour, le jeu tire 1 quête
     par palier — 3 quêtes du jour, mixant accessible et ambitieux.
   • WEEKLY_CHALLENGES : 1 défi par semaine, plus exigeant.
   • LEGEND_QUESTS  : défis légendaires thématiques et spectaculaires,
     1 par semaine en rotation (« champion du monde avec l'Italie »,
     « Coupe des Champions avec un club parti du régional »…).
   Sélection déterministe à partir de la date (identique pour tous).
   Conditions évaluées par game.ts (questFulfilled) en fin de carrière.
   pts : récompense affichée, cumulée dans le score de quêtes.
   ============================================================ */
export const DAILY_QUESTS = [
  // --- Palier 1 · Facile (10 pts) ------------------------------------------
  { id: "q_defensive", tier: 1, pts: 10, icon: "🧤", name: "Côté obscur", desc: "Terminer une carrière de défenseur ou de gardien." },
  { id: "q_exotic", tier: 1, pts: 10, icon: "🏜️", name: "L'or du désert", desc: "Signer dans un club du Golfe (Arabie Saoudite, Qatar ou Émirats)." },
  { id: "q_low_title", tier: 1, pts: 10, icon: "🌾", name: "Gloire de l'ombre", desc: "Être champion de D2 ou de division régionale." },
  { id: "q_fr_career", tier: 1, pts: 10, icon: "🇫🇷", name: "Cocorico", desc: "Terminer une carrière complète avec un joueur français." },
  { id: "q_cup", tier: 1, pts: 10, icon: "🏵️", name: "Coupe de feu", desc: "Remporter une coupe nationale." },
  { id: "q_ballon_top30", tier: 1, pts: 10, icon: "⭐", name: "Dans la lumière", desc: "Être classé au Ballon d'Or (top 30) au moins une fois." },
  // --- Palier 2 · Moyen (25 pts) -------------------------------------------
  { id: "q_leader", tier: 2, pts: 25, icon: "🗣️", name: "Porte-voix", desc: "Décrocher le trait Leader né." },
  { id: "q_one_club", tier: 2, pts: 25, icon: "❤️", name: "Fidèle", desc: "Une carrière complète sans transfert définitif." },
  { id: "q_3countries", tier: 2, pts: 25, icon: "🌍", name: "Passeport chargé", desc: "Jouer dans 3 pays différents." },
  { id: "q_young_int", tier: 2, pts: 25, icon: "🐤", name: "Pépite", desc: "Être international A avant 21 ans." },
  { id: "q_moments3", tier: 2, pts: 25, icon: "🎬", name: "Grand soir", desc: "Réussir 3 moments décisifs dans une même carrière." },
  { id: "q_no_elite", tier: 2, pts: 25, icon: "⚒️", name: "Sans les géants", desc: "Carrière complète sans jamais jouer dans un club de l'élite." },
  { id: "q_fortune", tier: 2, pts: 25, icon: "💰", name: "Jackpot", desc: "Amasser 40 M€ de fortune personnelle." },
  { id: "q_cl", tier: 2, pts: 25, icon: "🥇", name: "Nuit européenne", desc: "Remporter une coupe continentale." },
  { id: "q_continental_nt", tier: 2, pts: 25, icon: "🌍", name: "Roi du continent", desc: "Remporter un championnat continental de sélection (Euro, Copa América ou CAN)." },
  { id: "q_double", tier: 2, pts: 25, icon: "🎭", name: "Le doublé", desc: "Gagner le championnat ET la coupe nationale la même saison." },
  { id: "q_derby3", tier: 2, pts: 25, icon: "🔥", name: "Roi du derby", desc: "Faire basculer 3 derbies dans une même carrière." },
  { id: "q_top_scorer", tier: 2, pts: 25, icon: "⚽", name: "Gâchette", desc: "Finir meilleur buteur de votre championnat." },
  // --- Palier 3 · Difficile (50 pts) ---------------------------------------
  { id: "q_rating90", tier: 3, pts: 50, icon: "💯", name: "Machine", desc: "Finir avec une note de carrière de 90 ou plus." },
  { id: "q_wc", tier: 3, pts: 50, icon: "🏆", name: "Sur le toit du monde", desc: "Remporter la Coupe du Monde avec votre nation." },
  { id: "q_globe", tier: 3, pts: 50, icon: "✈️", name: "Le globe-trotter", desc: "Jouer sur 3 continents dans une même carrière." },
  { id: "q_100caps", tier: 3, pts: 50, icon: "🎽", name: "Centurion", desc: "Atteindre 100 sélections nationales." },
  { id: "q_wc_it", tier: 3, pts: 50, icon: "🇮🇹", name: "La Squadra", desc: "Devenir champion du monde avec l'Italie." },
  { id: "q_samba", tier: 3, pts: 50, icon: "🇧🇷", name: "Samba d'or", desc: "Remporter le Ballon d'Or avec un joueur brésilien." },
  { id: "q_goleador", tier: 3, pts: 50, icon: "⚽", name: "Goleador", desc: "Marquer 300 buts en carrière." },
  { id: "q_awards5", tier: 3, pts: 50, icon: "🏅", name: "Collectionneur", desc: "Cumuler 5 distinctions individuelles dans une même carrière." },
  { id: "q_golden_shoe", tier: 3, pts: 50, icon: "👟", name: "Soulier d'Or", desc: "Remporter le Soulier d'Or européen (buts × coefficient du championnat)." },
];

export const WEEKLY_CHALLENGES = [
  { id: "w_prodige", pts: 60, icon: "🚀", name: "La carrière du prodige", desc: "Atteindre 85 de général avant 23 ans." },
  { id: "w_patron", pts: 60, icon: "👑", name: "Le patron du vestiaire", desc: "Décrocher le trait Leader né ET un titre de champion." },
  { id: "w_remontada", pts: 60, icon: "🏔️", name: "La remontada", desc: "Partir d'un club régional et gagner un titre de première division." },
  { id: "w_last_contract", pts: 60, icon: "🌇", name: "Le dernier contrat", desc: "Signer dans le Golfe (Arabie Saoudite, Qatar ou Émirats) après 33 ans." },
  { id: "w_double_ballon", pts: 60, icon: "🌟", name: "La dynastie", desc: "Remporter 2 Ballons d'Or dans une même carrière." },
  { id: "w_five_clubs", pts: 60, icon: "🧳", name: "L'aventurier", desc: "Porter les couleurs d'au moins 5 clubs différents." },
  { id: "w_goals400", pts: 60, icon: "💣", name: "L'artificier", desc: "Marquer 400 buts en carrière." },
];

// Défis légendaires : le sel du jeu. Un par semaine, en rotation.
export const LEGEND_QUESTS = [
  { id: "l_epopee_cl", pts: 120, icon: "🏔️", name: "L'Épopée d'Europe", desc: "Remporter la Coupe des Champions avec un club que vous avez connu au niveau régional." },
  { id: "l_squadra", pts: 120, icon: "🇮🇹", name: "Il Campione del Mondo", desc: "Devenir champion du monde avec l'Italie." },
  { id: "l_from_dust", pts: 120, icon: "🌱", name: "Parti de rien", desc: "Débuter au niveau régional et soulever un trophée continental dans la même carrière." },
  { id: "l_samba_rey", pts: 120, icon: "👑", name: "O Rei", desc: "Avec un Brésilien : remporter le Ballon d'Or ET la Coupe du Monde." },
  { id: "l_kaiser", pts: 120, icon: "🦅", name: "Der Kaiser", desc: "Avec un Allemand : 100 sélections et un Ballon d'Or." },
  { id: "l_grand_chelem", pts: 120, icon: "🏰", name: "Le Grand Chelem", desc: "Être champion de première division dans les 5 grands pays d'Europe." },
  { id: "l_nomad", pts: 120, icon: "🧭", name: "Sans frontières", desc: "Jouer dans 4 pays différents dans une même carrière." },
  { id: "l_dynastie", pts: 120, icon: "🌟", name: "La Dynastie", desc: "Remporter 3 Ballons d'Or dans une même carrière." },
];

export const BADGE_CATS = [
  { id: "precocite", name: "Précocité", icon: "🐣" },
  { id: "trophees", name: "Trophées & distinctions", icon: "🏆" },
  { id: "championnats", name: "Championnats", icon: "🎖️" },
  { id: "performances", name: "Performances", icon: "📊" },
  { id: "selection", name: "Sélection nationale", icon: "🎽" },
  { id: "parcours", name: "Parcours & fidélité", icon: "🧭" },
  { id: "secret", name: "Secrets", icon: "❓" },
  { id: "graal", name: "Le Graal", icon: "💎" },
];

export const BADGES = [
  // --- Précocité ---
  { id: "wonderkid", cat: "precocite", icon: "🚀", name: "Prodige", hint: "Exploser avant l'heure…", desc: "Atteindre 85 de niveau général avant 22 ans." },
  { id: "prodigy", cat: "precocite", icon: "✨", name: "Élu précoce", hint: "La gloire n'attend pas le nombre des années…", desc: "Remporter un Ballon d'Or avant 24 ans." },
  { id: "early_cap", cat: "precocite", icon: "🐤", name: "Premier de cordée", hint: "Le maillot national avant même la majorité…", desc: "Être convoqué en sélection A avant 19 ans." },
  { id: "youth_prospect", cat: "precocite", icon: "🌱", name: "Graine de crack", hint: "Repéré dès les catégories de jeunes…", desc: "Être sélectionné avec les U17 de votre nation." },
  // --- Trophées & distinctions ---
  { id: "first_ballon_or", cat: "trophees", icon: "⭐", name: "Ballon d'Or", hint: "La plus haute distinction individuelle…", desc: "Remporter au moins un Ballon d'Or." },
  { id: "ballon_3", cat: "trophees", icon: "🌟", name: "Dynastie", hint: "Régner, encore et encore…", desc: "Remporter 3 Ballons d'Or dans une même carrière." },
  { id: "golden_boots", cat: "trophees", icon: "👟", name: "Serial buteur", hint: "Le meilleur devant le but, plusieurs fois…", desc: "Remporter 3 Souliers d'Or dans une même carrière." },
  { id: "award_10", cat: "trophees", icon: "🏅", name: "Vitrine pleine", hint: "Les récompenses s'empilent…", desc: "Cumuler 10 distinctions individuelles dans une même carrière." },
  { id: "wc_golden_badge", cat: "trophees", icon: "🌍", name: "Roi du Mondial", hint: "Le meilleur, sur la plus grande scène…", desc: "Être élu meilleur joueur d'une Coupe du Monde." },
  { id: "triple", cat: "trophees", icon: "🎯", name: "Triplé mythique", secret: true, desc: "Gagner le championnat, la Coupe des Champions et la Coupe du Monde la même saison.", hint: "Trois trophées majeurs, une seule saison…" },
  // --- Championnats ---
  { id: "champ_3pays", cat: "championnats", icon: "🗺️", name: "Conquérant", hint: "Un titre ici, un titre là-bas, un titre ailleurs…", desc: "Être champion (toutes divisions) dans 3 pays différents." },
  { id: "champ_big5", cat: "championnats", icon: "🏰", name: "Grand Chelem", hint: "Les cinq royaumes d'Europe, un par un…", desc: "Remporter le championnat de première division dans les 5 grands pays européens." },
  { id: "champ_d1d2", cat: "championnats", icon: "🪜", name: "Double étage", hint: "Champion en bas, champion en haut…", desc: "Gagner une D2 et une D1 dans le même pays." },
  { id: "champ_2continents", cat: "championnats", icon: "✈️", name: "Champion des deux mondes", hint: "Un titre de chaque côté de l'océan…", desc: "Être champion sur deux continents différents." },
  { id: "champ_epopee", cat: "championnats", icon: "🏔️", name: "L'Épopée", hint: "Du fin fond du football à son sommet, ensemble…", desc: "Gagner un titre de première division avec un club que vous aviez déjà mené au titre en division inférieure." },
  { id: "champ_sans_elite", cat: "championnats", icon: "⚒️", name: "À la force du poignet", hint: "Tout gagner, sans jamais rejoindre les géants…", desc: "Gagner 2 championnats de première division sans jamais jouer dans un club de l'élite." },
  // --- Performances ---
  { id: "prolific_scorer", cat: "performances", icon: "⚽", name: "Buteur historique", hint: "Faire trembler les filets, encore et encore…", desc: "Marquer 450 buts en carrière." },
  { id: "iron_man", cat: "performances", icon: "🦾", name: "Increvable", hint: "Une longévité hors du commun…", desc: "Disputer 800 matchs professionnels." },
  { id: "ageless", cat: "performances", icon: "🕰️", name: "L'Éternel", hint: "Défier le temps, saison après saison…", desc: "Disputer une saison à 40 ans ou plus." },
  { id: "mathusalem", cat: "performances", icon: "⏳", name: "Mathusalem", hint: "Repousser encore les limites de l'âge…", desc: "Disputer une saison à 45 ans ou plus." },
  { id: "wall", cat: "performances", icon: "🧱", name: "La Muraille", hint: "Une cage inviolable, saison après saison…", desc: "En tant que gardien, cumuler 150 clean sheets en carrière." },
  { id: "moment_5", cat: "performances", icon: "🎬", name: "Monsieur les grands soirs", hint: "Quand tout brûle, certains respirent…", desc: "Réussir 5 moments décisifs dans une même carrière." },
  { id: "derby_3", cat: "performances", icon: "🔥", name: "Roi du derby", hint: "La ville n'a qu'un seul patron…", desc: "Faire basculer 3 derbies dans une même carrière." },
  // --- Sélection nationale ---
  { id: "world_cup", cat: "selection", icon: "🏆", name: "Champion du monde", hint: "Le rêve ultime de tout gamin…", desc: "Remporter la Coupe du Monde avec votre nation." },
  { id: "centurion", cat: "selection", icon: "🎽", name: "Centurion", hint: "Porter cent fois le maillot national…", desc: "Atteindre 100 sélections avec votre nation." },
  { id: "nations_league", cat: "selection", icon: "🛡️", name: "Roi d'Europe des sélections", hint: "Dominer le continent entre deux grands tournois…", desc: "Remporter la Ligue des Sélections avec votre nation." },
  { id: "olympic_gold", cat: "selection", icon: "🥇", name: "Champion olympique", hint: "L'or au cou, sur la plus grande scène amateur…", desc: "Remporter la médaille d'or aux Jeux Olympiques." },
  { id: "arab_cup", cat: "selection", icon: "🌙", name: "Champion arabe", hint: "De l'Atlantique au Golfe, tout un monde derrière vous…", desc: "Remporter la Coupe arabe avec votre nation." },
  { id: "regional_gold", cat: "selection", icon: "🏅", name: "Champion des Jeux régionaux", hint: "L'or devant les siens, sur la scène du continent…", desc: "Remporter la médaille d'or aux Jeux de votre continent (asiatiques, africains, panaméricains ou du Pacifique)." },
  // --- Parcours & fidélité ---
  { id: "legend_tier", cat: "parcours", icon: "👑", name: "Légende vivante", hint: "Atteindre le sommet absolu…", desc: "Terminer une carrière avec le rang « Légende du football mondial »." },
  { id: "one_club", cat: "parcours", icon: "❤️", name: "Une vie, un club", hint: "La fidélité absolue, du début à la fin…", desc: "Réussir une belle carrière sans jamais être transféré (les prêts sont tolérés)." },
  { id: "captain_100", cat: "parcours", icon: "🅒", name: "Capitaine centurion", hint: "Cent fois le brassard au bras…", desc: "Disputer 100 matchs ou plus en tant que capitaine." },
  { id: "homecoming", cat: "parcours", icon: "🏡", name: "L'enfant du pays", hint: "Revenir finir là où tout a commencé…", desc: "Terminer sa carrière dans son club formateur, après avoir porté d'autres couleurs." },
  { id: "three_countries", cat: "parcours", icon: "🌍", name: "Globe-trotter", hint: "Le football n'a pas de frontières…", desc: "Jouer dans au moins 3 pays différents." },
  { id: "well_traveled", cat: "parcours", icon: "🧳", name: "Voyageur assidu", hint: "Beaucoup de vestiaires, beaucoup de maillots…", desc: "Porter les couleurs d'au moins 5 clubs." },
  { id: "moneybags", cat: "parcours", icon: "💰", name: "Nabab", hint: "Une fortune à faire pâlir les émirs…", desc: "Amasser 100 M€ de fortune personnelle." },
  { id: "rival_slayer", cat: "parcours", icon: "⚔️", name: "Némésis", hint: "Dominer son rival, encore et encore…", desc: "Surpasser votre rival 3 carrières de suite." },
  { id: "showtime", cat: "parcours", icon: "🎭", name: "Idole des foules", hint: "Plus qu'un joueur : un spectacle…", desc: "Finir une carrière avec le trait Showman et 88+ de réputation." },
  { id: "quest_streak7", cat: "parcours", icon: "🔥", name: "L'Habitué", hint: "Revenir, jour après jour…", desc: "Accomplir au moins une quête du jour 7 jours d'affilée." },
  { id: "quest_20", cat: "parcours", icon: "🎯", name: "Chasseur de quêtes", hint: "Les défis sont une seconde nature…", desc: "Accomplir 20 quêtes ou défis au total." },
  // --- Secrets ---
  { id: "comeback", cat: "secret", icon: "🔄", name: "Renaissance", secret: true, desc: "Mener une carrière complète juste après une carrière brisée.", hint: "Repartir de zéro après le pire…" },
  { id: "survivor", cat: "secret", icon: "🩹", name: "Miraculé", secret: true, desc: "Terminer une carrière complète malgré une blessure très grave.", hint: "Le corps a lâché, pas vous…" },
  { id: "panenka_or", cat: "secret", icon: "🥄", name: "La Cuillère", secret: true, desc: "Réussir une panenka dans une finale.", hint: "Une audace folle au pire moment…" },
  { id: "double_agent", cat: "secret", icon: "😈", name: "Ennemi public", secret: true, desc: "Signer chez le club rival juré de vos supporters.", hint: "Trahir ceux qui vous chantaient…" },
  // --- Le Graal ---
  { id: "platine", cat: "graal", icon: "💎", name: "Palmarès Absolu", hint: "Tout. Absolument tout…", desc: "Débloquer tous les autres badges du jeu." },
];

/* ============================================================
   AVANTAGES DE DÉPART (boutique de jetons) — méta-progression.
   Les jetons se gagnent en accomplissant des quêtes ; on les
   dépense ici pour DÉBLOQUER un avantage (achat définitif), puis
   on ÉQUIPE jusqu'à 2 avantages actifs pour ses prochaines
   carrières NORMALES. Le Défi du jour les ignore (équité).
   cost : prix en jetons. fx : appliqué à la création (game.ts
   applyPerks) — pot = potentiel caché, t/p/m/c = stats, rep,
   money (M€), trait = trait de départ (id d'un TRAITS).
   ============================================================ */
export const PERKS = [
  { id: "scout", icon: "📣", name: "Déjà repéré", cost: 200, desc: "Réputation de départ +15 : les recruteurs vous connaissent déjà.", fx: { rep: 15 } },
  { id: "nest_egg", icon: "💰", name: "Cuillère d'argent", cost: 250, desc: "Vous débutez avec +2 M€ d'avance sur les autres.", fx: { money: 2 } },
  { id: "gifted", icon: "🎓", name: "Don précoce", cost: 400, desc: "+4 en Technique dès vos premiers pas chez les pros.", fx: { t: 4 } },
  { id: "prodige", icon: "🌟", name: "Pépite", cost: 600, desc: "+6 de potentiel caché : un plafond plus haut, souvent une étoile de plus.", fx: { pot: 6 } },
  { id: "captain", icon: "🗣️", name: "Tempérament de chef", cost: 800, desc: "Vous démarrez avec le trait Leader né.", fx: { trait: "leader" } },
];

export const PERK_SLOTS = 2; // nombre d'avantages équipables simultanément

/* ============================================================
   SÉRIE DE QUÊTES — paliers récompensés (long terme).
   La série n'a PAS de plafond : chaque palier atteint verse des
   jetons (une fois par série — retomber à zéro ré-arme les paliers,
   pour donner envie de reconstruire). Un JOKER de gel est gagné
   tous les 7 jours de série (2 max en réserve) : un jour manqué
   est pardonné automatiquement, la série survit.
   ============================================================ */
export const STREAK_MILESTONES = [
  { days: 3, jetons: 10 },
  { days: 7, jetons: 25 },
  { days: 14, jetons: 50 },
  { days: 30, jetons: 120 },
  { days: 60, jetons: 250 },
  { days: 100, jetons: 400 },
  { days: 200, jetons: 800 },
  { days: 365, jetons: 2000 },
];
