// E-mails du compte : confirmation d'inscription et mot de passe oublié.
import nodemailer, { type Transporter } from "nodemailer";
import { config, mailEnabled } from "./config";

let transport: Transporter | null = null;

async function send(to: string, subject: string, text: string): Promise<void> {
  if (!mailEnabled()) throw new Error("e-mails non configurés");
  transport ??= nodemailer.createTransport(config.smtpUrl);
  await transport.sendMail({ from: config.mailFrom, to, subject, text });
}

export function sendConfirmation(to: string, token: string): Promise<void> {
  const link = config.publicUrl + "/api/auth/confirm?token=" + encodeURIComponent(token);
  return send(to, "Open Eleven — confirmez votre adresse",
    "Bienvenue sur Open Eleven !\n\nPour activer votre compte, ouvrez ce lien :\n" + link +
    "\n\nLe lien est valable 48 heures. Si vous n'êtes pas à l'origine de cette inscription, ignorez ce message.\n");
}

export function sendRecovery(to: string, token: string): Promise<void> {
  // Le jeton voyage dans le fragment (#) : il n'est jamais envoyé à un serveur
  // par le navigateur, ni écrit dans un journal d'accès.
  const link = config.publicUrl + "/#type=recovery&token=" + encodeURIComponent(token);
  return send(to, "Open Eleven — nouveau mot de passe",
    "Vous avez demandé à changer de mot de passe.\n\nOuvrez ce lien pour en choisir un nouveau :\n" + link +
    "\n\nLe lien est valable 1 heure. Si vous n'avez rien demandé, ignorez ce message : votre mot de passe reste inchangé.\n");
}
