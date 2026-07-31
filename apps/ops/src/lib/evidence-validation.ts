/**
 * Validasi teknis otomatis atas link bukti (PRD 5.2 — "validasi teknis
 * dilakukan otomatis oleh sistem"). Dipanggil dari job Agenda
 * `validate-evidence`, BUKAN langsung di Server Action, supaya submission
 * tidak pernah menunggu respons server eksternal yang lambat (DDT 6.1).
 */

const ACCEPTED_CONTENT_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export type EvidenceValidationResult =
  | { accessible: true; formatValid: true }
  | { accessible: false; formatValid: false; failureReason: string }
  | { accessible: true; formatValid: false; failureReason: string };

export async function validateEvidenceLink(url: string): Promise<EvidenceValidationResult> {
  const timeoutMs = Number(process.env.EVIDENCE_VALIDATION_TIMEOUT_MS ?? 8000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Langkah 1: cek aksesibilitas — HEAD lebih murah daripada GET penuh.
    const headResponse = await fetch(url, { method: "HEAD", signal: controller.signal });
    if (!headResponse.ok) {
      return {
        accessible: false,
        formatValid: false,
        failureReason: `Link tidak dapat diakses (status ${headResponse.status}).`,
      };
    }

    // Langkah 2: cek format dokumen dari header Content-Type.
    // Sebagian layanan (mis. Google Drive) tidak selalu mengembalikan
    // Content-Type akurat lewat HEAD — fallback ke "diterima" bila header
    // tidak ada, karena tujuan utamanya mencegah link benar-benar rusak/mati,
    // bukan menggantikan review substansi Bapperida atas ISI dokumen.
    const contentType = headResponse.headers.get("content-type")?.split(";")[0]?.trim();
    if (contentType && !ACCEPTED_CONTENT_TYPES.includes(contentType)) {
      return {
        accessible: true,
        formatValid: false,
        failureReason: `Format dokumen (${contentType}) tidak didukung. Gunakan PDF atau gambar.`,
      };
    }

    return { accessible: true, formatValid: true };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "Waktu tunggu habis" : "Link tidak dapat dijangkau";
    return { accessible: false, formatValid: false, failureReason: `${reason} saat memvalidasi link.` };
  } finally {
    clearTimeout(timeout);
  }
}
