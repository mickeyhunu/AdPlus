# ~/apps/AdPlus/deploy.sh
set -euo pipefail
BRANCH="${1:-main}"

echo ">>> Git update"
cd ~/apps/AdPlus
git fetch --all --prune
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH" || { echo "git pull 실패 → git reset --hard origin/$BRANCH"; git reset --hard "origin/$BRANCH"; }

echo ">>> Frontend build & publish"
cd frontend
npm ci || npm install
npm run build
sudo mkdir -p /var/www/adplus-frontend
sudo rsync -av --delete dist/ /var/www/adplus-frontend/

echo ">>> Backend deps & reload"
cd ../backend
npm ci || npm install
pm2 reload adplus-api
pm2 save

echo ">>> Smoke test"
curl -s -I -H "Host: adplus.store" http://127.0.0.1/ | head -n 1 || true
curl -s -i -H "Host: adplus.store" http://127.0.0.1/api/health || true

echo "DONE"


# chmod +x ~/apps/AdPlus/deploy.sh
# ~/apps/AdPlus/deploy.sh 