/**
 * DDT v2.0 Section 3.5 — Sumber Data Otomatis (Satu Data & API, PRD 5.2.3).
 * Pola connector-per-sumber, SENGAJA eksplisit per integrasi (bukan sistem
 * plugin dinamis) — lihat DDT v2.0 Section 5: jumlah sumber data yang
 * diperkirakan (Satu Data, BPS, mungkin beberapa kementerian) kecil, dan
 * masing-masing punya kontrak API cukup berbeda untuk tidak diabstraksi
 * berlebihan. Menambah sumber baru = tambah 1 file konektor + 1 baris di
 * registry ini.
 */
export interface DataSourceConnector {
  fetchValue(
    variableId: string,
    periodYear: number,
    periodLabel: string
  ): Promise<{ value: string } | null>;
}

import { satuDataConnector } from "./satuDataConnector";

export const DATA_SOURCE_CONNECTORS: Record<string, DataSourceConnector> = {
  satu_data_boyolali: satuDataConnector,
};

export function getConnector(apiConnectorKey: string): DataSourceConnector | null {
  return DATA_SOURCE_CONNECTORS[apiConnectorKey] ?? null;
}
