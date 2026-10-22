// Mots interdits dans les pseudos (modération).
//
// Source UNIQUE : l'interface s'en sert pour répondre tout de suite, le
// serveur pour trancher. Correspondance en MOT ENTIER, sans tenir compte de
// la casse ni des accents.
// Pour une liste plus complète : LDNOOBW (github.com/LDNOOBW/
// List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words).

export const FORBIDDEN_WORDS: string[] = [
    // --- Français : insultes / vulgarités ---
    "con", "conne", "connard", "connasse", "conard", "conasse",
    "salaud", "salop", "salope", "salopard", "salaupe",
    "pute", "putain", "pute", "pouffiasse", "poufiasse", "pétasse", "petasse",
    "enculé", "encule", "enculer", "enculee", "enculés", "encule",
    "niquer", "nique", "niquez", "niker",
    "fdp", "ntm", "tg", "tafiole", "tapette", "tarlouze", "tarlouse",
    "merde", "merdeux", "merdique", "chier", "chiotte",
    "batard", "bâtard", "batards", "connerie", "couille", "couilles",
    "bite", "biteS", "zboub", "teub", "chatte", "foutre",
    "pd", "pédé", "pede", "pedale", "pédale", "gouine",
    "sucemabite", "ntmr", "fils2pute",
    // --- Français : insultes racistes / haineuses ---
    "negre", "nègre", "negro", "bougnoule", "bougnol", "bicot",
    "youpin", "youpine", "feuj", "raton", "chinetoque", "niakoué", "niakoue",
    "sale arabe", "sale juif", "sale noir", "sale blanc",
    // --- Anglais : profanity ---
    "fuck", "fucker", "fucking", "motherfucker", "fuk", "fck",
    "shit", "bullshit", "shitty", "asshole", "arsehole", "ass",
    "bitch", "bastard", "dick", "dickhead", "cock", "pussy",
    "cunt", "twat", "wanker", "prick", "slut", "whore", "hoe",
    "bollocks", "bugger", "damn", "crap",
    // --- Anglais : slurs (haineux) ---
    "nigger", "nigga", "nigg", "faggot", "fag", "retard", "retarded",
    "chink", "spic", "kike", "coon", "wetback", "tranny", "dyke",
    "gook", "paki", "beaner",
    // --- Sexuel / explicite ---
    "porn", "porno", "sex", "sexe", "boobs", "penis", "vagina", "anal",
    "blowjob", "handjob", "creampie", "hentai", "rape", "raped", "rapist", "viol", "violeur",
    // --- Haine / extrémisme ---
    "nazi", "nazism", "hitler", "heil", "kkk", "isis", "daesh", "jihad",
    "genocide", "genocidaire", "terroriste",
    // --- Espagnol (courant) ---
    "puta", "mierda", "cabron", "cabrón", "pendejo", "coño", "cono", "gilipollas", "maricon", "maricón", "joder",
];
