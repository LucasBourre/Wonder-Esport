#!/bin/sh
# Reprend dans Open Eleven une sauvegarde Supabase (le fichier .sql produit par
# « npm run sauvegarde:supabase »).
#
#   sh packages/server/scripts/import-sauvegarde.sh chemin/vers/supabase-AAAA-MM-JJ.sql
#
# À lancer sur la machine qui fait tourner Docker, dans le dossier du dépôt, une fois
# la pile démarrée (docker compose up -d). Le fichier est rechargé dans une base
# temporaire (un conteneur jetable), puis import-supabase.js en copie les comptes et
# les données dans la vraie base. Rien n'est écrit dans la vraie base en cas d'erreur.
#
# La base d'Open Eleven doit être vide de comptes. Pour repartir de zéro, par exemple
# après des comptes d'essai :
#   docker compose exec db psql -U openeleven openeleven -c "truncate users cascade"
set -eu

fichier="${1:?Indiquez le fichier .sql de la sauvegarde.}"
[ -f "$fichier" ] || { echo "Fichier introuvable : $fichier" >&2; exit 1; }
fichier="$(cd "$(dirname "$fichier")" && pwd)/$(basename "$fichier")"

cd "$(dirname "$0")/../../.."

base="$(docker compose ps -q db)"
[ -n "$base" ] || { echo "La base d'Open Eleven ne tourne pas : lancez d'abord « docker compose up -d »." >&2; exit 1; }
reseau="$(docker inspect -f '{{range $nom, $_ := .NetworkSettings.Networks}}{{$nom}} {{end}}' "$base" | cut -d' ' -f1)"

source="oe-source-$$"
trap 'docker stop "$source" > /dev/null 2>&1 || true' EXIT

echo "Base temporaire pour lire la sauvegarde…"
docker run -d --rm --name "$source" --network "$reseau" -e POSTGRES_PASSWORD=source postgres:17-alpine > /dev/null
for i in $(seq 1 60); do
  docker exec "$source" pg_isready -U postgres -h 127.0.0.1 > /dev/null 2>&1 && break
  sleep 1
done
sleep 2

# Ce que Supabase fournit d'office et que la sauvegarde suppose : le schéma « auth »
# avec la table des comptes (la sauvegarde n'en contient que les lignes).
docker exec -i "$source" psql -U postgres -q -v ON_ERROR_STOP=1 <<'SQL'
create schema auth;
create table auth.users (
  instance_id text, id uuid primary key, aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, invited_at timestamptz, confirmation_token text, confirmation_sent_at timestamptz,
  recovery_token text, recovery_sent_at timestamptz, email_change_token_new text, email_change text,
  email_change_sent_at timestamptz, last_sign_in_at timestamptz, raw_app_meta_data text, raw_user_meta_data text,
  is_super_admin text, created_at timestamptz, updated_at timestamptz, phone text, phone_confirmed_at timestamptz,
  phone_change text, phone_change_token text, phone_change_sent_at timestamptz, email_change_token_current text,
  email_change_confirm_status text, banned_until timestamptz, reauthentication_token text,
  reauthentication_sent_at timestamptz, is_sso_user text, deleted_at timestamptz, is_anonymous text
);
create function auth.uid() returns uuid language sql as 'select null::uuid';
SQL

echo "Chargement de la sauvegarde…"
# Les comptes sont à la fin du fichier, après les tables qui les référencent : on les charge
# d'abord, puis le reste, pour que les clés étrangères trouvent leurs comptes.
awk '/^COPY auth\.users /{f=1} f{print} f&&$0=="\\."{exit}' "$fichier" | docker exec -i "$source" psql -U postgres -q -v ON_ERROR_STOP=1
awk 'f&&$0=="\\."{f=0;next} /^COPY auth\.users /{f=1} !f' "$fichier" | docker exec -i "$source" psql -U postgres -q 2>&1 > /dev/null | grep -v 'schema "public" already exists' || true

echo "Import dans Open Eleven…"
docker compose run --rm -T \
  -e SUPABASE_DB_URL="postgres://postgres:source@$source:5432/postgres" \
  server node packages/server/scripts/import-supabase.js
