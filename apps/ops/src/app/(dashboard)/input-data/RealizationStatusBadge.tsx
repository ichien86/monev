const STATUS_META: Record<string, { label: string; className: string }> = {
  validasi_link: { label: "Memvalidasi Link…", className: "bg-info-tint text-info" },
  validasi_format: { label: "Memeriksa Format Dokumen…", className: "bg-info-tint text-info" },
  validasi_ekstraksi: { label: "Memeriksa Isi Dokumen…", className: "bg-info-tint text-info" },
  menunggu_konfirmasi_pd: { label: "Menunggu Konfirmasi Anda", className: "bg-accent-tint text-accent" },
  ditandai_gagal_ekstrak: { label: "Ekstraksi Gagal — Tetap Diproses", className: "bg-accent-tint text-accent" },
  menunggu_admin_perencana: { label: "Menunggu Review Admin Perencana", className: "bg-accent-tint text-accent" },
  disetujui: { label: "Disetujui", className: "bg-success-tint text-success" },
  ditolak: { label: "Ditolak", className: "bg-danger-tint text-danger" },
  final_otomatis: { label: "Final Otomatis (Satu Data/API)", className: "bg-success-tint text-success" },
};

export function RealizationStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, className: "bg-bg text-muted" };
  return (
    <span className={`font-mono text-[10.5px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${meta.className}`}>
      {meta.label}
    </span>
  );
}
