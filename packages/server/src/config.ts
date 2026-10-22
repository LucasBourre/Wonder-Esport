// Configuration du serveur, lue une fois dans l'environnement.

const env = (name: string, fallback = ""): string => (process.env[name] ?? fallback).trim();

/** Adresse publique du jeu : sert aux liens des e-mails et au contrôle d'origine. */
const publicUrl = env("PUBLIC_URL", "http://localhost:5173").replace(/\/+$/, "");

export const config = {
  port: Number(env("PORT", "3000")),
  host: env("HOST", "0.0.0.0"),
  databaseUrl: env("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/openeleven"),
  publicUrl,
  /** Cookie de session réservé au HTTPS dès que le site l'est. */
  secureCookie: publicUrl.startsWith("https://"),
  /**
   * Envoi d'e-mails (confirmation d'inscription, mot de passe oublié).
   * Exemple : smtps://utilisateur:motdepasse@smtp.exemple.fr:465
   * Vide = pas d'e-mails : les comptes sont actifs dès l'inscription, et la
   * réinitialisation du mot de passe par e-mail est indisponible.
   */
  smtpUrl: env("SMTP_URL"),
  mailFrom: env("MAIL_FROM", "Open Eleven <no-reply@localhost>"),
  /** Durée d'une session, en jours. */
  sessionDays: 60,
};

export const mailEnabled = (): boolean => config.smtpUrl !== "";
