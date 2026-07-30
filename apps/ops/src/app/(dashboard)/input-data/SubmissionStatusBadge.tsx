const STATUS_META: Record<string, { label: string; className: string }> = {
  validasi_link: { label: "Memvalidasi Link…", className: "bg-info-tint text-info" },
  validasi_format: { label: "Memeriksa Format Dokumen…", className: "bg-info-tint text-info" },
  ditolak_sistem: { label: "Ditolak Sistem", className: "bg-danger-tint text-danger" },
  menunggu_bapperida: { label: "Menunggu Review Bapperida", className: "bg-accent-tint text-accent" },
  disetujui: { label: "Disetujui", className: "bg-success-tint text-success" },
  ditolak_bapperida: { label: "Ditolak Bapperida", className: "bg-danger-tint text-danger" },
};

export function SubmissionStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, className: "bg-bg text-muted" };
  return (
    <span className={`font-mono text-[10.5px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${meta.className}`}>
      {meta.label}
    </span>
  );
}
