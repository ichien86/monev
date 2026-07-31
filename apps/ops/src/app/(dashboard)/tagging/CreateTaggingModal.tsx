"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createTagging } from "./actions";

type Theme = { _id: string; name: string; colorHex: string };
type TargetNode = { _id: string; name: string; level: string };

export function CreateTaggingModal({
  node,
  themes,
  budgetYear,
  onClose,
  onDone,
}: {
  node: TargetNode;
  themes: Theme[];
  budgetYear: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [themeId, setThemeId] = useState(themes[0]?._id ?? "");
  const [coverage, setCoverage] = useState<"penuh" | "sebagian">("penuh");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await createTagging({
      themeId,
      budgetStructureId: node._id,
      budgetYear,
      coverage,
      requiresSubTagging: false,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-surface rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-mono text-muted uppercase">Tag Node</div>
            <div className="text-base font-semibold text-ink mt-0.5">{node.name}</div>
          </div>
          <button onClick={onClose} aria-label="Tutup">
            <X size={18} className="text-muted" />
          </button>
        </div>

        {themes.length === 0 ? (
          <div className="text-sm text-faint mt-4">Belum ada tema. Buat tema dulu di filter atas.</div>
        ) : (
          <>
            <label className="flex flex-col gap-1.5 mt-4">
              <span className="text-xs font-mono text-muted uppercase">Tema</span>
              <select value={themeId} onChange={(e) => setThemeId(e.target.value)} className="px-3 py-2 rounded-lg border border-border text-sm">
                {themes.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 mt-4">
              <span className="text-xs font-mono text-muted uppercase">Cakupan Anggaran</span>
              <select
                value={coverage}
                onChange={(e) => setCoverage(e.target.value as "penuh" | "sebagian")}
                className="px-3 py-2 rounded-lg border border-border text-sm"
              >
                <option value="penuh">Seluruh anggaran</option>
                <option value="sebagian">Sebagian — persentase dientri PD saat realisasi</option>
              </select>
            </label>

            {node.level !== "subkegiatan" && (
              <div className="text-[11.5px] text-muted bg-bg rounded-lg px-3 py-2 mt-3">
                Tag di level {node.level === "program" ? "Program" : "Kegiatan"} akan otomatis berlaku
                (cascade) untuk seluruh turunannya (PRD 5.6).
              </div>
            )}

            {error && <div className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2 mt-3">{error}</div>}

            <div className="flex gap-3 mt-5">
              <button
                disabled={busy}
                onClick={submit}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "Menyimpan…" : "Simpan Tag"}
              </button>
              <button onClick={onClose} className="px-4 py-2 text-sm text-muted">
                Batal
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
