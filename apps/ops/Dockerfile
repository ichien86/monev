# Dockerfile untuk SIMONEV Ops — dipakai DUA service di docker-compose.yml:
# service web (CMD default: `npm start`) dan service worker Agenda.js
# (CMD override: `npm run worker`). Karena worker butuh node_modules penuh
# (tsx, agenda), image ini SENGAJA tidak memakai Next.js output "standalone"
# — lihat catatan di next.config.ts.

FROM node:20-alpine AS base
WORKDIR /repo

# Layer terpisah untuk manifest paket saja → cache Docker tidak invalidasi
# ulang `npm install` setiap kali hanya source code yang berubah.
COPY package.json package-lock.json* ./
COPY apps/ops/package.json ./apps/ops/package.json
COPY apps/eksekutif/package.json ./apps/eksekutif/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/schemas/package.json ./packages/schemas/package.json

RUN npm install --no-audit --no-fund

COPY packages ./packages
COPY apps/ops ./apps/ops

RUN npm run build -w apps/ops

WORKDIR /repo/apps/ops
ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
