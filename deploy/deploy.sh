#!/bin/sh
# Met le serveur à jour avec la dernière version de main : récupère le code, reconstruit
# et relance les conteneurs. Lancé par la CI (job « deploiement »), ou à la main :
# sh deploy/deploy.sh
#
# Avant la mise à jour, la base est sauvegardée dans ~/sauvegardes (les 14 dernières
# sont gardées) : les migrations s'appliquent au démarrage du serveur.
set -eu

cd "$(dirname "$0")/.."

# Un seul déploiement à la fois.
exec 9>/tmp/open-eleven-deploy.lock
flock -n 9 || { echo "Un déploiement est déjà en cours."; exit 1; }

dossier="$HOME/sauvegardes"
mkdir -p "$dossier"
if docker compose ps --status running --services 2>/dev/null | grep -qx db; then
  fichier="$dossier/avant-deploiement-$(date +%Y-%m-%d_%H-%M-%S).sql"
  if docker compose exec -T db pg_dump -U openeleven openeleven > "$fichier"; then
    echo "Base sauvegardée : $fichier"
  else
    rm -f "$fichier"
    echo "Sauvegarde de la base impossible : mise à jour poursuivie." >&2
  fi
  ls -1t "$dossier"/avant-deploiement-*.sql 2>/dev/null | tail -n +15 | xargs -r rm -f
fi

git fetch --quiet origin main
git reset --hard origin/main
echo "Version déployée : $(git log --oneline -1)"

docker compose up -d --build --wait
docker image prune -f > /dev/null
echo "Déploiement terminé."
