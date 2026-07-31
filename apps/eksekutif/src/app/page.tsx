import { auth, signOut } from "@/auth";
import { getReadmodelSnapshotModel } from "@simonev/db";
import { AlertTriangle, Info } from "lucide-react";

/**
 * ISR — DDT Section 4.A & 6.3. Halaman ini TIDAK menjalankan agregasi apa
 * pun: hanya membaca satu dokumen snapshot terbaru dari simonev_readmodel,
 * yang sudah "dimatangkan" oleh worker `sync-readmodel` di SIMONEV Ops.
 * revalidate=900 detik (15 menit) selaras dengan jadwal job tersebut.
 */
export const revalidate = 900;

function rp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

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
                  <StatusBar dist={statusDistribution} />
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
                {(snapshot.temaSummary ?? []).length === 0 ? (
                  <div className="bg-surface border border-border rounded-xl p-6 text-sm text-faint">
                    Belum ada data tagging tematik tersinkron.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {(snapshot.temaSummary ?? []).map((tema) => (
                      <div key={tema.themeId.toString()} className="bg-surface border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ background: tema.colorHex }}
                          />
                          <span className="text-sm font-semibold text-ink">{tema.themeName}</span>
                        </div>
                        <div className="font-mono text-xl font-semibold text-ink mt-2.5">
                          {rp(tema.paguTerTag)}
                        </div>
                        <div className="text-[11px] text-muted mt-0.5">
                          Pagu ter-tag · {tema.jumlahProgram} program
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

function StatusBar({
  dist,
}: {
  dist: { tercapai: number; proses: number; belumTercapai: number };
}) {
  const total = dist.tercapai + dist.proses + dist.belumTercapai || 1;
  const segments = [
    { label: "Tercapai", val: dist.tercapai, color: "#2F7A4C" },
    { label: "Proses", val: dist.proses, color: "#C08A28" },
    { label: "Belum Tercapai", val: dist.belumTercapai, color: "#B23A2E" },
  ];
  return (
    <div>
      <div className="flex w-full h-3 rounded-full overflow-hidden bg-border">
        {segments.map((s) => (
          <div key={s.label} style={{ width: `${(s.val / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: s.color }} />
            <span className="text-[12.5px] text-muted">{s.label}</span>
            <span className="font-mono text-[12.5px] text-ink font-semibold">{s.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
