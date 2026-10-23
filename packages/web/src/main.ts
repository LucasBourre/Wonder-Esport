// Point d'entrée de l'application. L'ordre des imports EST l'ordre de démarrage :
// chaque module de l'interface s'exécute en entier avant le suivant, et lit ce
// que le précédent a posé sur `window` (OE, I18N, OpenElevenAccount…).
import "./game";
// Export de la fiche en image et partage : lit window.OE, posé par game.ts.
import "./game-card";
// Traduction : traduit les tables de contenu dès son exécution, avant le
// premier écran (rendu par game.ts sur DOMContentLoaded).
import "./i18n";
// Compte, sauvegarde en ligne, classements, amis et duels, puis les salles.
import "./account";
import "./room";
// Notifications : cloche, bandeaux en direct ; s'appuie sur le compte et les salles.
import "./notifs";
import "./sw-register";
