// Modération des pseudos. La liste est celle de l'interface (un seul fichier,
// dans le contenu) : l'interface s'en sert pour répondre tout de suite, le
// serveur pour trancher.
import { FORBIDDEN_WORDS } from "@open-eleven/content";

// Minuscules, sans accents, ponctuation ramenée à des espaces : « Nègre » ne
// passe pas plus que « negre », ni « le_negre » que « le negre ».
const normalize = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ");

const words = FORBIDDEN_WORDS.map((w) => normalize(w).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).filter(Boolean);
const pattern = new RegExp("\\b(" + words.join("|") + ")\\b");

export const pseudoForbidden = (pseudo: string): boolean => pattern.test(normalize(pseudo));
