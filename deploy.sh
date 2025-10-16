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
pm2 reload adplus
pm2 save

echo ">>> Smoke test"
curl -s -I -H "Host: adplus.store" http://127.0.0.1/ | head -n 1 || true
curl -s -i -H "Host: adplus.store" http://127.0.0.1/api/health || true

echo "DONE"

# ssh -i .\adPlusKey.pem ubuntu@54.180.2.23 --- cmd에서 우분투 접속

# sudo nano /etc/nginx/sites-available/adplus --- cmd에서 nginx 우회수정


# cd ADPLUS

# chmod +x ~/apps/AdPlus/deploy.sh --- sh준비
# ~/apps/AdPlus/deploy.sh --- sh실행
# sudo nginx -t && sudo systemctl reload nginx --- 적용
# pm2 restart adplus-api --- 재실행