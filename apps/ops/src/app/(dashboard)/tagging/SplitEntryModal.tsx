"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { enterSplitCoverage } from "./actions";

export function SplitEntryModal({
  taggingId,
  themeName,
  currentPercent,
  onClose,
  onDone,
}: {
  taggingId: string;
  themeName: string;
  currentPercent: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [percent, setPercent] = useState(currentPercent ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await enterSplitCoverage({ taggingId, coveragePercent: percent });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-sm bg-surface rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-ink">Entri Cakupan — {themeName}</div>
          <button onClick={onClose} aria-label="Tutup">
            <X size={18} className="text-muted" />
          </button>
        </div>
        <p className="text-xs text-muted mt-2">
          Proporsi anggaran subkegiatan ini yang mendukung tema, dientri saat realisasi (PRD 5.6).
        </p>
        <label className="flex flex-col gap-1.5 mt-4">
          <span className="text-xs font-mono text-muted uppercase">Persentase (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-border text-sm font-mono"
          />
        </label>
        {error && <div className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2 mt-3">{error}</div>}
        <div className="flex gap-3 mt-5">
          <button
            disabled={busy}
            onClick={submit}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted">
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
