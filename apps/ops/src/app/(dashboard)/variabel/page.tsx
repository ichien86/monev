import { listVariables } from "./actions";
import { VariableForm } from "./VariableForm";

export default async function VariabelPage() {
  const variables = await listVariables();

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-ink">Master Data Variabel</h1>
        <p className="text-sm text-muted mt-1">
          Variabel adalah master data bersama yang dipakai di formula banyak Indikator sekaligus
          (DDT v2.0 Section 2.1, PRD 5.1.4) — realisasinya selalu global per periode.
        </p>
      </div>

      <VariableForm />

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg">
              {["Nama", "Satuan", "Status"].map((h) => (
                <th key={h} className="text-left px-5 py-2.5 font-mono text-[10px] text-muted uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {variables.map((v) => (
              <tr key={v._id.toString()} className="border-t border-border">
                <td className="px-5 py-3 font-medium">{v.name}</td>
                <td className="px-5 py-3 font-mono text-xs text-muted">{v.unit}</td>
                <td className="px-5 py-3">
                  <span
                    className={`font-mono text-[10.5px] font-semibold px-2.5 py-1 rounded-full ${
                      v.isActive ? "bg-success-tint text-success" : "bg-bg text-muted"
                    }`}
                  >
                    {v.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
              </tr>
            ))}
            {variables.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-faint text-sm">
                  Belum ada Variabel.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
