import { listReportableIndicators, listMySubmissions } from "./actions";
import { SubmissionForm } from "./SubmissionForm";
import { SubmissionStatusBadge } from "./SubmissionStatusBadge";

export default async function InputDataPage() {
  const [indicators, submissions] = await Promise.all([
    listReportableIndicators(),
    listMySubmissions(),
  ]);

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-ink">Input Data & Bukti</h1>
        <p className="text-sm text-muted mt-1">
          Laporkan realisasi indikator beserta link bukti (F-04). Validasi teknis link &amp;
          format dilakukan otomatis oleh sistem — tim Bapperida hanya menilai isi dokumen.
        </p>
      </div>

      <SubmissionForm indicatorOptions={indicators.map((i) => ({ _id: i._id.toString(), label: i.label }))} />

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border text-sm font-semibold text-ink">
          Riwayat Submission
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg">
              {["Indikator", "Periode", "Nilai", "Status"].map((h) => (
                <th key={h} className="text-left px-5 py-2.5 font-mono text-[10px] text-muted uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {submissions.map((s: any) => (
              <tr key={s._id.toString()} className="border-t border-border">
                <td className="px-5 py-3">{s.indicatorId?.label ?? "—"}</td>
                <td className="px-5 py-3 text-muted">
                  {s.periodLabel} {s.periodYear}
                </td>
                <td className="px-5 py-3 font-mono">{s.reportedValue}</td>
                <td className="px-5 py-3">
                  <SubmissionStatusBadge status={s.status} />
                </td>
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-faint text-sm">
                  Belum ada submission.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
