import { listOrgUnits, listBidangUrusanOptions } from "./actions";
import { OrgUnitForm } from "./OrgUnitForm";

export default async function OrgUnitPage() {
  const [units, bidangUrusanOptions] = await Promise.all([listOrgUnits(), listBidangUrusanOptions()]);

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-ink">Perangkat Daerah</h1>
        <p className="text-sm text-muted mt-1">
          Master data PD & Bidang Urusan pemerintahan yang diampu (F-10, DDT v2.0 Section 2.9).
        </p>
      </div>

      <OrgUnitForm bidangUrusanOptions={bidangUrusanOptions} />

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg">
              {["Nama", "Kode SIPD", "Bidang Urusan", "Eksternal"].map((h) => (
                <th key={h} className="text-left px-5 py-2.5 font-mono text-[10px] text-muted uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {units.map((unit: any) => (
              <tr key={unit._id.toString()} className="border-t border-border">
                <td className="px-5 py-3 font-medium">{unit.name}</td>
                <td className="px-5 py-3 font-mono text-xs text-muted">{unit.sipdCode}</td>
                <td className="px-5 py-3 text-muted">
                  {(unit.bidangUrusanIds ?? []).map((b: any) => b.name).join(", ")}
                </td>
                <td className="px-5 py-3">
                  {unit.isExternal && (
                    <span className="font-mono text-[10.5px] font-semibold px-2.5 py-1 rounded-full bg-info-tint text-info">
                      Eksternal
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {units.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-faint text-sm">
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
