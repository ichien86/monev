import { listFinalValuesForReport, listWorkUnitsForFilter } from "./actions";
import { LaporanFilterBar } from "./LaporanFilterBar";

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; workUnitId?: string }>;
}) {
  const params = await searchParams;
  const periodYear = params.year ? Number(params.year) : new Date().getFullYear();

  const [rows, workUnits] = await Promise.all([
    listFinalValuesForReport({ periodYear, workUnitId: params.workUnitId }),
    listWorkUnitsForFilter(),
  ]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-ink">Tabel Data &amp; Ekspor</h1>
        <p className="text-sm text-muted mt-1">
          Rincian nilai final per indikator, dihitung dari formula variabel (F-11, DDT v2.0 Section
          3.2). Dashboard ringkasan untuk pimpinan ada di SIMONEV Eksekutif.
        </p>
      </div>

      <LaporanFilterBar workUnits={JSON.parse(JSON.stringify(workUnits))} />

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg">
              {["Indikator", "PD", "Tahun", "Nilai", "Status", "Update Terakhir"].map((h) => (
                <th key={h} className="text-left px-5 py-2.5 font-mono text-[10px] text-muted uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.indicatorId} className="border-t border-border">
                <td className="px-5 py-3">{r.indicatorLabel}</td>
                <td className="px-5 py-3 text-muted">{r.workUnitName ?? "—"}</td>
                <td className="px-5 py-3 text-muted">{r.periodYear}</td>
                <td className="px-5 py-3 font-mono">
                  {r.value ?? "—"} {r.value !== null ? r.unit ?? "" : ""}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`font-mono text-[10.5px] font-semibold px-2.5 py-1 rounded-full ${
                      r.status === "lengkap" ? "bg-success-tint text-success" : "bg-accent-tint text-accent"
                    }`}
                  >
                    {r.status === "lengkap" ? "Lengkap" : "Belum Lengkap"}
                  </span>
                </td>
                <td className="px-5 py-3 font-mono text-xs text-muted">
                  {r.approvedAt ? new Date(r.approvedAt).toLocaleDateString("id-ID") : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-faint text-sm">
                  Tidak ada data untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
