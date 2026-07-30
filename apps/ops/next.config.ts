import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CATATAN: TIDAK memakai output "standalone" di sini (berbeda dari
  // apps/eksekutif) — image apps/ops juga dipakai untuk proses worker
  // Agenda.js (lihat docker-compose.yml: service simonev-agenda-worker
  // memakai Dockerfile yang sama), yang butuh node_modules penuh
  // (tsx, agenda, dll.) — bukan hasil trace dependency ala Next.js standalone.
  // Paket workspace (@simonev/db, @simonev/schemas) berupa TypeScript mentah,
  // bukan hasil build — Next.js perlu diberi tahu untuk mentranspilasinya.
  transpilePackages: ["@simonev/db", "@simonev/schemas"],
  experimental: {
    serverActions: {
      // Batas default 1MB cukup untuk seluruh form di PRD (form tidak
      // mengunggah file — bukti berupa link, lihat PRD 5.2).
      bodySizeLimit: "1mb",
    },
  },
};

export default nextConfig;
