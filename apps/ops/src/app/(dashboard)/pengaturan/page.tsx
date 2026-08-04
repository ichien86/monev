import { auth } from "@/auth";
import { getCurrentTahunAktif } from "./actions";
import { TahunAktifForm } from "./TahunAktifForm";

export default async function PengaturanPage() {
  const session = await auth();
  const currentValue = await getCurrentTahunAktif();
  const canManage = session?.user.role === "admin_sistem";

  return (
    <div className="p-8 max-w-lg">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-ink">Pengaturan Sistem</h1>
        <p className="text-sm text-muted mt-1">
          Tahun Aktif (PRD 5.5.1, DDT v2.0 Section 2.11) — menentukan konteks tahun default di
          seluruh modul (tagging, sumber data otomatis, dsb.).
        </p>
      </div>

      {canManage ? (
        <TahunAktifForm currentValue={currentValue} />
      ) : (
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="text-xs font-mono text-muted uppercase tracking-wide">Tahun Aktif Saat Ini</div>
          <div className="font-display text-3xl font-semibold text-ink mt-1">{currentValue}</div>
          <div className="text-xs text-faint mt-2">Hanya Admin Sistem yang dapat mengubah nilai ini.</div>
        </div>
      )}
    </div>
  );
}
