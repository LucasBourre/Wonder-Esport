// Limites de débit des routes de compte, en mémoire.
//
// Un compteur unique « 30 requêtes par adresse IP » punissait les réseaux
// partagés (école, entreprise, téléphone en 4G : des centaines de joueurs derrière
// une seule adresse) tout en comptant des connexions réussies. Chaque limite vise
// maintenant un abus précis :
//
//   • les ÉCHECS de connexion, par couple (adresse, compte) : on devine un mot de
//     passe, pas on se connecte. Un succès remet le compteur à zéro. L'adresse fait
//     partie de la clé : un tiers ne peut donc pas verrouiller le compte d'un autre
//     depuis chez lui ;
//   • un plafond LARGE par adresse sur l'ensemble des appels (le hachage bcrypt coûte
//     du processeur), calibré pour un réseau partagé ;
//   • les inscriptions, par adresse ;
//   • les e-mails envoyés (confirmation, mot de passe oublié), par adresse ET par
//     destinataire : sans cela, le serveur devient un robot à spam.
//
// Se remet à zéro au redémarrage, ce qui suffit ici.

export class Window {
  private hits = new Map<string, { count: number; reset: number }>();
  constructor(readonly max: number, readonly windowMs: number) {}

  private entry(key: string, now: number) {
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (v.reset < now) this.hits.delete(k);
    const e = this.hits.get(key);
    return e && e.reset >= now ? e : undefined;
  }
  /** Le plafond est-il atteint ? (ne compte rien) */
  blocked(key: string): boolean {
    const e = this.entry(key, Date.now());
    return !!e && e.count >= this.max;
  }
  /** Compte une occurrence ; renvoie false si le plafond est dépassé. */
  hit(key: string): boolean {
    const now = Date.now();
    const e = this.entry(key, now);
    if (!e) { this.hits.set(key, { count: 1, reset: now + this.windowMs }); return this.max >= 1; }
    e.count++;
    return e.count <= this.max;
  }
  clear(key: string): void { this.hits.delete(key); }
}

const minutes = (n: number) => n * 60 * 1000;

export const limits = {
  /** Tous les appels d'authentification d'une adresse : large, pour un réseau partagé. */
  ip: new Window(200, minutes(10)),
  /** Échecs de connexion d'un même couple (adresse, compte). */
  loginFailures: new Window(8, minutes(15)),
  /** Comptes créés depuis une adresse. */
  signups: new Window(12, minutes(60)),
  /** E-mails demandés pour une adresse e-mail donnée. */
  mailPerAccount: new Window(5, minutes(60)),
  /** E-mails demandés depuis une adresse IP. */
  mailPerIp: new Window(30, minutes(60)),
};
