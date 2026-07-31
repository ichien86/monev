# SIMONEV Eksekutif — murni web, tanpa proses worker (DDT Section 4.A),
# sehingga bisa memakai output "standalone" Next.js untuk image produksi
# yang jauh lebih kecil dibanding image apps/ops.

FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/ops/package.json ./apps/ops/package.json
COPY apps/eksekutif/package.json ./apps/eksekutif/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/schemas/package.json ./packages/schemas/package.json
RUN npm install --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/package.json ./package.json
COPY packages ./packages
COPY apps/eksekutif ./apps/eksekutif
RUN npm run build -w apps/eksekutif

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /repo/apps/eksekutif/.next/standalone ./
COPY --from=builder /repo/apps/eksekutif/.next/static ./apps/eksekutif/.next/static
COPY --from=builder /repo/apps/eksekutif/public ./apps/eksekutif/public

EXPOSE 3001
CMD ["node", "apps/eksekutif/server.js"]
