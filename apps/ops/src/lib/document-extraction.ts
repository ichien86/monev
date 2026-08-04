/**
 * DDT v2.0 Section 3.4 — Validasi Ekstraksi Konten Dokumen (PRD 5.2.2).
 * Dipanggil dari job `validate-extraction` (worker), BUKAN langsung di
 * Server Action, karena OCR berat secara komputasi (lihat catatan di job-nya).
 *
 * KETERBATASAN DITEMUKAN SAAT QA (belum ada perbaikan yang terbukti andal):
 * `pdf-parse@1.1.4` membundel pdf.js versi sangat lama (v1.10.100, ~2018)
 * yang dipaksa jalan tanpa Worker (disableWorker=true, satu-satunya mode
 * yang bisa jalan di Node). Diuji manual lewat worker Agenda sungguhan:
 * dokumen valid yang PERTAMA diproses dalam satu proses kadang berhasil
 * diekstrak, tapi dokumen (bahkan byte identik) yang diproses SETELAHNYA
 * dalam proses yang sama sering gagal dengan FormatError acak dari pdf.js
 * ("bad XRef entry", "Invalid number: ...", dst.) -- polanya TIDAK
 * konsisten (sempat dicoba mitigasi dengan memaksa require.cache dibuang
 * per panggilan supaya modul pdf.js selalu dimuat ulang segar, tapi itu
 * TIDAK terbukti memperbaiki keadaan pada pengujian ulang, jadi tidak
 * dipertahankan). Kemungkinan besar ini bug/keterbatasan pdf.js versi lama
 * itu sendiri saat dipaksa jalan di luar Web Worker, bukan sesuatu yang bisa
 * diperbaiki dari sisi pemanggil. Perbaikan yang tepat adalah mengganti
 * pdf-parse dengan library aktif (mis. panggil `pdfjs-dist` versi modern
 * langsung) -- keputusan dependency yang di luar cakupan QA ini. Sampai itu
 * dilakukan, `outcome: "failed"` pada dokumen PDF yang sebenarnya valid HARUS
 * dianggap kemungkinan besar palsu (false negative dari library, bukan
 * dokumen yang benar-benar rusak) -- karena itu alur DDT v2.0 3.4 sendiri
 * memang sudah dirancang untuk tidak memblokir PD tanpa batas waktu kalau
 * ekstraksi gagal (status `ditandai_gagal_ekstrak`, tetap masuk antrean
 * review Admin Perencana, bukan ditolak).
 */
import pdfParse from "pdf-parse";
import { createWorker } from "tesseract.js";

export type ExtractionOutcome =
  | { outcome: "matched"; extractedValue: string }
  | { outcome: "mismatch"; extractedValue: string | null }
  | { outcome: "failed" };

function normalizeNumberFragment(raw: string): string {
  // Format Indonesia: titik pemisah ribuan, koma desimal.
  return raw.replace(/\./g, "").replace(",", ".");
}

/**
 * Cari angka di `text` yang mendekati `reportedValue` (toleransi pembulatan
 * ±0.5) — bukan exact string match, supaya format penulisan yang sedikit
 * berbeda (mis. "1.234,5" vs "1234.50") tetap dianggap cocok.
 */
function findNumericMatch(text: string, reportedValue: string): string | null {
  const target = parseFloat(normalizeNumberFragment(reportedValue));
  if (!Number.isFinite(target)) return null;

  const candidates = text.match(/-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?/g) ?? [];
  for (const candidate of candidates) {
    const value = parseFloat(normalizeNumberFragment(candidate));
    if (Number.isFinite(value) && Math.abs(value - target) < 0.5) {
      return candidate;
    }
  }
  return null;
}

async function runOcr(buffer: Buffer): Promise<string> {
  const worker = await createWorker("ind");
  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);
    return text?.trim() ?? "";
  } finally {
    await worker.terminate();
  }
}

export async function extractValueFromDocument(
  fileBuffer: Buffer,
  contentType: string,
  reportedValue: string
): Promise<ExtractionOutcome> {
  let text = "";
  try {
    if (contentType === "application/pdf") {
      const parsed = await pdfParse(fileBuffer);
      text = parsed.text?.trim() ?? "";
    }
    // PDF born-digital menghasilkan teks memadai langsung dari pdf-parse.
    // PDF hasil scan (gambar dibungkus PDF) atau file gambar biasanya
    // menghasilkan teks nyaris kosong — fallback ke OCR (Tesseract.js).
    if (!text || text.length < 20) {
      text = await runOcr(fileBuffer);
    }
  } catch (error) {
    console.warn("[document-extraction] Ekstraksi gagal total:", error);
    return { outcome: "failed" };
  }

  if (!text) return { outcome: "failed" };

  const match = findNumericMatch(text, reportedValue);
  if (match) return { outcome: "matched", extractedValue: match };
  return { outcome: "mismatch", extractedValue: text.slice(0, 200) || null };
}
