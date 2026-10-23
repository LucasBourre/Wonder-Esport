// Avatars de profil : trois familles de teintes, douze coiffures chacune. Le fichier de
// l'avatar « clair-01 » est /src/img/avatar/clair-01.png. Le serveur n'accepte que ces
// identifiants (cf. profile_set_avatar).

export const AVATAR_GROUPS = [
  { id: "clair", label: "Clair" },
  { id: "fonce", label: "Foncé" },
  { id: "mat", label: "Mat" },
] as const;

export const AVATAR_IDS: string[] = AVATAR_GROUPS.flatMap((g) =>
  Array.from({ length: 12 }, (_, i) => g.id + "-" + String(i + 1).padStart(2, "0")));

export const isAvatarId = (v: unknown): v is string => typeof v === "string" && AVATAR_IDS.includes(v);
