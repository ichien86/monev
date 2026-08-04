/**
 * Grafik dashboard pimpinan (DDT Section 4.A: "Server-rendered SVG kustom
 * untuk grafik statis" — di sini HTML/CSS murni, RSC, nol JS klien, selaras
 * dengan NFR "Dashboard < 3 detik" & mobile-friendly. Recharts baru relevan
 * kalau suatu saat pimpinan minta interaktivitas hover, lihat DDT 4.A).
 */

function rp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

/**
 * Distribusi status capaian — part-to-whole, stacked bar horizontal.
 * Warna pakai token STATUS yang sudah ada di desain sistem (success/accent/
 * danger), bukan palet kategorikal baru — tercapai/proses/belum tercapai
 * secara semantik memang baik/waspada/kritis, bukan sekadar identitas seri.
 */
export function StatusDistributionChart({
  dist,
}: {
  dist: { tercapai: number; proses: number; belumTercapai: number };
}) {
  const total = dist.tercapai + dist.proses + dist.belumTercapai || 1;
  const segments = [
    { label: "Tercapai", val: dist.tercapai, className: "bg-success" },
    { label: "Proses", val: dist.proses, className: "bg-accent" },
    { label: "Belum Tercapai", val: dist.belumTercapai, className: "bg-danger" },
  ];

  return (
    <div>
      <div className="flex w-full h-3 rounded-full overflow-hidden gap-[2px] bg-border">
        {segments.map((s) => (
          <div
            key={s.label}
            className={s.val > 0 ? s.className : ""}
            style={{ width: `${(s.val / total) * 100}%` }}
          />
        ))}
      </div>
      {/* Legend -- selalu ada untuk >=2 seri; teks pakai token tinta, bukan
          warna data (marks-and-anatomy: "text never wears the data color"). */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full inline-block ${s.className}`} />
            <span className="text-[12.5px] text-muted">{s.label}</span>
            <span className="font-mono text-[12.5px] text-ink font-semibold">{s.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type TemaItem = {
  themeId: string;
  themeName: string;
  colorHex: string;
  paguTerTag: number;
  jumlahProgram: number;
};

/**
 * Pagu ter-tag per tema -- perbandingan magnitude lintas kategori bernama,
 * horizontal bar chart. Warna tiap bar memakai colorHex milik tema itu
 * sendiri (identitas yang sudah konsisten dipakai di seluruh modul Tagging
 * di SIMONEV Ops), bukan palet baru -- "color follows the entity". Label
 * nama tema & nilai SELALU di luar bar (bukan di dalam), supaya tidak ada
 * risiko teks terpotong untuk tema dengan pagu kecil/nol.
 */
export function TemaBarChart({ items }: { items: TemaItem[] }) {
  if (items.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 text-sm text-faint">
        Belum ada data tagging tematik tersinkron.
      </div>
    );
  }

  const sorted = [...items].sort((a, b) => b.paguTerTag - a.paguTerTag);
  const max = Math.max(...sorted.map((t) => t.paguTerTag), 1);

  return (
    <div className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-4">
      {sorted.map((t) => (
        <div key={t.themeId} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-ink">{t.themeName}</span>
            <span className="text-[11px] text-faint shrink-0">{t.jumlahProgram} program</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-5 rounded-sm bg-bg overflow-hidden">
              <div
                className="h-full rounded-r-[4px]"
                style={{
                  width: t.paguTerTag > 0 ? `${Math.max((t.paguTerTag / max) * 100, 2)}%` : "0%",
                  background: t.colorHex,
                }}
              />
            </div>
            <span className="font-mono text-[12.5px] text-ink font-semibold shrink-0 w-28 text-right">
              {rp(t.paguTerTag)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
