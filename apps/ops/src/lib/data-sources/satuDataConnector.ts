import type { DataSourceConnector } from "./registry";

/**
 * Konektor contoh untuk "Satu Data Boyolali" (DDT v2.0 Section 3.5).
 *
 * STUB — endpoint/kredensial Satu Data Boyolali belum tersedia di lingkungan
 * pengembangan ini (sama seperti keterbatasan MongoDB nyata yang sudah
 * didokumentasikan di README). Struktur `DataSourceConnector` sudah lengkap
 * dan dipanggil oleh job `pullExternalSources` (lihat
 * apps/ops/src/worker/jobs/pullExternalSources.job.ts) — tinggal mengisi
 * implementasi `fetchValue` di bawah begitu kontrak API Satu Data tersedia.
 */
export const satuDataConnector: DataSourceConnector = {
  async fetchValue(_variableId: string, _periodYear: number, _periodLabel: string) {
    console.warn(
      "[satuDataConnector] Belum diimplementasikan — endpoint Satu Data Boyolali belum tersedia."
    );
    return null;
  },
};
