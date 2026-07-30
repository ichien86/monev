import Agenda from "agenda";

/**
 * Agenda.js menyimpan antrean jobnya sendiri di koleksi `agendaJobs` pada
 * database yang sama dengan data transaksi (simonev_core) — keputusan sadar
 * DDT Section 2 & 4.B untuk menghindari penambahan Redis demi kesederhanaan
 * infrastruktur ("minimalis", DDT Section 1.2).
 */
const mongoUri = process.env.MONGODB_URI_CORE;
if (!mongoUri) {
  throw new Error("MONGODB_URI_CORE belum diset — worker tidak bisa terhubung ke Agenda store.");
}

export const agenda = new Agenda({
  db: { address: mongoUri, collection: "agendaJobs" },
  processEvery: "30 seconds",
  maxConcurrency: 10,
});
