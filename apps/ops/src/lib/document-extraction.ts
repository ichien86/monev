/**
 * DDT v2.0 Section 3.4 — Validasi Ekstraksi Konten Dokumen (PRD 5.2.2).
 * Dipanggil dari job `validate-extraction` (worker), BUKAN langsung di
 * Server Action, karena OCR berat secara komputasi (lihat catatan di job-nya).
 *
 * CATATAN: fungsi ini belum pernah diuji terhadap dokumen sungguhan di
 * lingkungan pengembangan ini (tidak ada MongoDB nyata ataupun akses berkas
 * bukti sungguhan tersedia di sini — batasan yang sama seperti yang sudah
 * didokumentasikan di README untuk seluruh alur database).
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
