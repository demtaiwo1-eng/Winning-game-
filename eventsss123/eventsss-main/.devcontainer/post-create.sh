#!/usr/bin/env bash
set -e
cd apps/api
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
fi
cd ../..
npm install
npm run prisma:generate
# wait for Postgres, then create/apply migrations
for i in $(seq 1 30); do
  if [ -d apps/api/prisma/migrations ]; then
    npm run -w apps/api db:deploy >/dev/null 2>&1 && break
  else
    npm run -w apps/api db:migrate -- --name init >/dev/null 2>&1 && break
  fi
  sleep 2
done
npm run db:seed || true
echo "ESS ready. Run: npm run dev   |   npm run check"
