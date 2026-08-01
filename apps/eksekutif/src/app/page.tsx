import { auth, signOut } from "@/auth";
import { getReadmodelSnapshotModel } from "@simonev/db";
import { AlertTriangle, Info } from "lucide-react";
import { StatusDistributionChart, TemaBarChart } from "./_components/DashboardCharts";

/**
 * ISR — DDT Section 4.A & 6.3. Halaman ini TIDAK menjalankan agregasi apa
 * pun: hanya membaca satu dokumen snapshot terbaru dari simonev_readmodel,
 * yang sudah "dimatangkan" oleh worker `sync-readmodel` di SIMONEV Ops.
 * revalidate=900 detik (15 menit) selaras dengan jadwal job tersebut.
 */
export const revalidate = 900;

export default async function DashboardPage() {
  const session = await auth();
  const SnapshotModel = await getReadmodelSnapshotModel();
  const snapshot = await SnapshotModel.findOne().sort({ generatedAt: -1 }).lean();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 md:px-10 h-[68px] border-b border-border bg-surface">
        <div>
          <div className="font-display text-base font-semibold text-ink">SIMONEV Eksekutif</div>
          <div className="text-[10px] font-mono text-muted uppercase tracking-wide">
            Dashboard Pimpinan · Kabupaten Boyolali
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted">{session?.user.name}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="text-xs text-muted hover:text-ink" type="submit">
              Keluar
            </button>
          </form>
        </div>
      </header>

      <main className="p-6 md:p-10 max-w-5xl mx-auto flex flex-col gap-8">
        {!snapshot ? (
          <div className="text-sm text-faint bg-surface border border-border rounded-xl p-8 text-center">
            Belum ada data ringkasan. Worker sinkronisasi read-model (SIMONEV Ops) belum pernah
            berjalan — lihat DDT Section 6.3.
          </div>
        ) : (
          <>
        {(() => {
          const totals = snapshot.totals ?? {
            sasaranStrategisDaerah: 0,
            indikatorUtama: 0,
            programPerangkatDaerah: 0,
            belumLaporPeriodeIni: 0,
          };
          const statusDistribution = snapshot.statusDistribution ?? {
            tercapai: 0,
            proses: 0,
            belumTercapai: 0,
          };
          return (
            <>
              <div className="flex flex-wrap gap-4">
                <StatCard label="Sasaran Strategis Daerah" value={String(totals.sasaranStrategisDaerah)} />
                <StatCard label="Indikator Kinerja Utama" value={String(totals.indikatorUtama)} />
                <StatCard label="Program Perangkat Daerah" value={String(totals.programPerangkatDaerah)} />
                <StatCard
                  label="Belum Lapor Periode Ini"
                  value={String(totals.belumLaporPeriodeIni)}
                  tone="text-danger"
                />
              </div>

              <section>
                <div className="text-xs font-mono text-muted uppercase tracking-wide mb-2">
                  Jalur Kinerja RPJMD
                </div>
                <div className="bg-surface border border-border rounded-xl p-6">
                  <div className="text-sm font-semibold text-ink mb-3">
                    Distribusi Status Capaian — Sasaran Strategis Daerah
                  </div>
                  <StatusDistributionChart dist={statusDistribution} />
                  <div className="flex items-start gap-2 mt-4 text-[11px] text-faint">
                    <Info size={13} className="mt-0.5 shrink-0" />
                    Diperbarui {new Date(snapshot.generatedAt).toLocaleString("id-ID")}. Status capaian
                    berasal dari data final yang sudah disetujui Bapperida di SIMONEV Ops.
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-mono text-muted uppercase tracking-wide">
                    Jalur Tagging Anggaran Tematik
                  </div>
                  <span className="text-[10px] font-mono text-faint">Independen dari data kinerja — PRD 4.1</span>
                </div>
                <TemaBarChart
                  items={(snapshot.temaSummary ?? []).map((tema) => ({
                    themeId: tema.themeId.toString(),
                    themeName: tema.themeName,
                    colorHex: tema.colorHex,
                    paguTerTag: tema.paguTerTag,
                    jumlahProgram: tema.jumlahProgram,
                  }))}
                />
                <div className="flex items-start gap-3 mt-4 p-4 rounded-xl bg-accent-tint">
                  <AlertTriangle size={16} className="text-accent mt-0.5 shrink-0" />
                  <div className="text-[12.5px] text-[#7A5A1C] leading-relaxed">
                    Angka antar tema dapat tumpang tindih (overlap) dan tidak dapat dijumlahkan sebagai
                    total anggaran unik (PRD 5.6).
                  </div>
                </div>
              </section>
            </>
          );
        })()}
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex-1 min-w-[150px]">
      <div className="text-[11px] font-mono text-muted uppercase tracking-wide">{label}</div>
      <div className={`font-mono text-2xl font-semibold mt-2 ${tone ?? "text-ink"}`}>{value}</div>
    </div>
  );
}
