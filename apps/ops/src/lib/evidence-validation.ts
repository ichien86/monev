/**
 * Validasi teknis otomatis atas link bukti (PRD 5.2 — "validasi teknis
 * dilakukan otomatis oleh sistem"). Dipanggil dari job Agenda
 * `validate-evidence`, BUKAN langsung di Server Action, supaya submission
 * tidak pernah menunggu respons server eksternal yang lambat (DDT 6.1).
 *
 * Dua tahap sesuai DDT 6.1 langkah 4 & Section 4.B:
 * 1. HEAD — aksesibilitas (status 2xx) + Content-Type yang diklaim server.
 * 2. GET parsial (byte range) — sniff beberapa byte pertama dan cocokkan
 *    dengan "magic number" format file sungguhan, supaya dokumen yang
 *    korup/kosong/salah format tidak lolos hanya karena header Content-Type
 *    (yang bisa salah/menyesatkan) kebetulan terlihat benar.
 */

const ACCEPTED_CONTENT_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

// Byte pembuka ("magic number") tiap format yang didukung — dicek terhadap
// beberapa byte pertama dokumen, bukan Content-Type saja (yang bisa keliru).
const MAGIC_SIGNATURES: { format: string; bytes: number[] }[] = [
  { format: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // "%PDF-"
  { format: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { format: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  // WEBP: "RIFF" di byte 0-3, "WEBP" di byte 8-11 — dicek terpisah di bawah.
];

function bytesStartWith(chunk: Uint8Array, signature: number[]): boolean {
  if (chunk.length < signature.length) return false;
  return signature.every((b, i) => chunk[i] === b);
}

function looksLikeWebp(chunk: Uint8Array): boolean {
  if (chunk.length < 12) return false;
  const riff = String.fromCharCode(...chunk.slice(0, 4));
  const webp = String.fromCharCode(...chunk.slice(8, 12));
  return riff === "RIFF" && webp === "WEBP";
}

function looksLikeHtml(chunk: Uint8Array): boolean {
  const text = String.fromCharCode(...chunk.slice(0, 15)).trim().toLowerCase();
  return text.startsWith("<!doctype") || text.startsWith("<html");
}

/** Ambil ~16 byte pertama lewat GET (Range request bila didukung server),
 *  lalu batalkan koneksi tanpa menunggu sisa body — supaya file besar tidak
 *  ikut terunduh penuh hanya untuk dicek jenisnya. */
async function fetchFirstBytes(url: string, signal: AbortSignal): Promise<Uint8Array | null> {
  const response = await fetch(url, {
    headers: { Range: "bytes=0-511" },
    signal,
  });
  if (!response.ok && response.status !== 206) return null;
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < 16) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (total === 0) return null;
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  return merged;
}

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

    // Langkah 3 (DDT 6.1 #4) — GET parsial: sniff byte pembuka dokumen
    // sungguhan, supaya file kosong/korup/salah format tidak lolos hanya
    // karena Content-Type kebetulan terlihat benar (atau tidak ada sama
    // sekali). Best-effort: kalau tahap ini sendiri gagal (timeout jaringan,
    // server menolak Range), JANGAN gagalkan submission yang HEAD-nya sudah
    // terbukti bisa diakses — cukup lewati pengecekan tambahan ini.
    let firstBytes: Uint8Array | null = null;
    try {
      firstBytes = await fetchFirstBytes(url, controller.signal);
    } catch {
      firstBytes = null;
    }

    if (firstBytes && firstBytes.length > 0) {
      const matchesKnownFormat =
        MAGIC_SIGNATURES.some((sig) => bytesStartWith(firstBytes!, sig.bytes)) || looksLikeWebp(firstBytes);

      if (!matchesKnownFormat) {
        if (looksLikeHtml(firstBytes)) {
          return {
            accessible: true,
            formatValid: false,
            failureReason:
              "Link mengarah ke halaman web (HTML), bukan file bukti langsung — gunakan link unduh/ekspor langsung, bukan link pratinjau.",
          };
        }
        return {
          accessible: true,
          formatValid: false,
          failureReason: "Dokumen tampak rusak atau bukan format PDF/gambar yang valid.",
        };
      }
    }
    // firstBytes null (Range tidak didukung/gagal diambil) -- tidak
    // memblokir; hasil sudah ditentukan oleh pengecekan Content-Type di atas.

    return { accessible: true, formatValid: true };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "Waktu tunggu habis" : "Link tidak dapat dijangkau";
    return { accessible: false, formatValid: false, failureReason: `${reason} saat memvalidasi link.` };
  } finally {
    clearTimeout(timeout);
  }
}
