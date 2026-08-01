import { listOrgUnits } from "./actions";
import { OrgUnitForm } from "./OrgUnitForm";

export default async function OrgUnitPage() {
  const units = await listOrgUnits();

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-ink">Perangkat Daerah</h1>
        <p className="text-sm text-muted mt-1">
          Master data PD & urusan pemerintahan yang diampu (F-10).
        </p>
      </div>

      <OrgUnitForm />

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg">
              <th className="text-left px-5 py-2.5 font-mono text-[10px] text-muted uppercase tracking-wide">
                Nama
              </th>
              <th className="text-left px-5 py-2.5 font-mono text-[10px] text-muted uppercase tracking-wide">
                Kode SIPD
              </th>
              <th className="text-left px-5 py-2.5 font-mono text-[10px] text-muted uppercase tracking-wide">
                Urusan
              </th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit._id.toString()} className="border-t border-border">
                <td className="px-5 py-3 font-medium">{unit.name}</td>
                <td className="px-5 py-3 font-mono text-xs text-muted">{unit.sipdCode}</td>
                <td className="px-5 py-3 text-muted">{unit.urusan?.join(", ")}</td>
              </tr>
            ))}
            {units.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-faint text-sm">
                  Belum ada data Perangkat Daerah.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
