import { listReportableVariables, listMyRealizations } from "./actions";
import { RealizationForm } from "./RealizationForm";
import { RealizationStatusCell } from "./RealizationStatusCell";

export default async function InputDataPage() {
  const [options, realizations] = await Promise.all([listReportableVariables(), listMyRealizations()]);

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-ink">Input Data & Bukti</h1>
        <p className="text-sm text-muted mt-1">
          Laporkan realisasi variabel beserta link bukti (F-04, DDT v2.0 Section 2.3). Validasi
          teknis link, format, dan isi dokumen dilakukan otomatis oleh sistem — Admin Perencana
          hanya menilai substansi.
        </p>
      </div>

      <RealizationForm options={options} />

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border text-sm font-semibold text-ink">
          Riwayat Realisasi
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg">
              {["Indikator", "Variabel", "Periode", "Nilai", "Status"].map((h) => (
                <th key={h} className="text-left px-5 py-2.5 font-mono text-[10px] text-muted uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {realizations.map((r: any) => (
              <tr key={r._id.toString()} className="border-t border-border">
                <td className="px-5 py-3">{r.indicatorId?.label ?? "—"}</td>
                <td className="px-5 py-3 text-muted">{r.variableId?.name ?? "—"}</td>
                <td className="px-5 py-3 text-muted">
                  {r.periodLabel} {r.periodYear}
                </td>
                <td className="px-5 py-3 font-mono">{r.reportedValue}</td>
                <td className="px-5 py-3">
                  <RealizationStatusCell id={r._id.toString()} status={r.status} />
                </td>
              </tr>
            ))}
            {realizations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-faint text-sm">
                  Belum ada realisasi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
