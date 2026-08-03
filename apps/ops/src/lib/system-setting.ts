import { getSystemSettingModel } from "@simonev/db";

/**
 * DDT v2.0 Section 2.11 — Tahun Aktif (PRD 5.5.1). Cache in-memory sederhana
 * per proses Node (server web ATAU worker, masing-masing punya cache-nya
 * sendiri — cukup untuk skala pengguna internal Pemkab, tidak butuh Redis).
 * Di-invalidate lewat invalidateTahunAktifCache() setiap kali Admin Sistem
 * mengubah nilainya (lihat pengaturan/actions.ts).
 */
const TAHUN_AKTIF_ID = "tahun_aktif";
let cache: { value: number; cachedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getTahunAktif(): Promise<number> {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    return cache.value;
  }

  const SystemSettingModel = await getSystemSettingModel();
  const doc = await SystemSettingModel.findById(TAHUN_AKTIF_ID).lean();
  const value = doc?.value ?? new Date().getFullYear(); // fallback sebelum Admin Sistem pernah mengatur nilai ini

  cache = { value, cachedAt: Date.now() };
  return value;
}

export function invalidateTahunAktifCache() {
  cache = null;
}
