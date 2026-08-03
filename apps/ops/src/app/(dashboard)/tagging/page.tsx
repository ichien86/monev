import { auth } from "@/auth";
import { listThemes, listBudgetTreeWithTags, listNomenclatureChanges } from "./actions";
import { TaggingClient } from "./TaggingClient";
import { getTahunAktif } from "@/lib/system-setting";

export default async function TaggingPage() {
  const session = await auth();
  const tahunAktif = await getTahunAktif();
  const [themes, tree, nomenclatureChanges] = await Promise.all([
    listThemes(),
    listBudgetTreeWithTags(tahunAktif),
    listNomenclatureChanges(),
  ]);
  const canManage = session?.user.role === "bapperida" || session?.user.role === "admin_sistem";

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-ink">Tagging Anggaran Tematik</h1>
        <p className="text-sm text-muted mt-1">
          Dukungan subkegiatan/rekening terhadap tema prioritas daerah — sepenuhnya independen dari
          jalur kinerja RPJMD (F-02, PRD 4.1 &amp; 5.7, DDT v2.0 Section 2.7). Tahun anggaran{" "}
          {tahunAktif}.
        </p>
      </div>
      <TaggingClient
        themes={JSON.parse(JSON.stringify(themes))}
        tree={JSON.parse(JSON.stringify(tree))}
        budgetYear={tahunAktif}
        myWorkUnitId={session?.user.workUnitId ?? null}
        canManage={canManage}
      />

      {canManage && (
        <div className="mt-8">
          <div className="text-xs font-mono text-muted uppercase tracking-wide mb-3">
            Riwayat Perubahan Nomenklatur SIPD (F-09)
          </div>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg">
                  {["Kode SIPD", "Field", "Tahun", "Nilai Lama", "Nilai Baru"].map((h) => (
                    <th key={h} className="text-left px-5 py-2.5 font-mono text-[10px] text-muted uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nomenclatureChanges.map((c) => (
                  <tr key={c._id.toString()} className="border-t border-border">
                    <td className="px-5 py-3 font-mono text-xs">{c.sipdCode}</td>
                    <td className="px-5 py-3 text-muted text-xs">{c.fieldChanged}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted">
                      {c.fromYear} → {c.toYear}
                    </td>
                    <td className="px-5 py-3 text-xs">{c.oldValue}</td>
                    <td className="px-5 py-3 text-xs font-semibold">{c.newValue}</td>
                  </tr>
                ))}
                {nomenclatureChanges.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-faint text-sm">
                      Belum ada perubahan nomenklatur terdeteksi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
