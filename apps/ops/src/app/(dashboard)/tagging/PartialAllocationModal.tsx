"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getTaggingAllocationEditor, setPartialAllocations } from "./actions";

type RekeningOption = { _id: string; name: string; sipdCode: string; pagu: number; realisasi: number };

function rp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

/**
 * DDT v2.0 Section 2.7 — menggantikan SplitEntryModal (persentase tunggal,
 * v1.0). PD memilih rekening spesifik di bawah subkegiatan yang ter-tag,
 * lalu mengisi nominal Rupiah per rekening (PRD 5.7.3).
 */
export function PartialAllocationModal({
  taggingId,
  themeName,
  onClose,
  onDone,
}: {
  taggingId: string;
  themeName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [rekeningOptions, setRekeningOptions] = useState<RekeningOption[]>([]);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getTaggingAllocationEditor(taggingId).then((data) => {
      if (!data) {
        setError("Tagging tidak ditemukan.");
        setLoading(false);
        return;
      }
      setRekeningOptions(data.rekeningOptions);
      const initial: Record<string, number> = {};
      for (const a of data.allocations) initial[a.rekeningStructureId] = a.amountRupiah;
      setAmounts(initial);
      setLoading(false);
    });
  }, [taggingId]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const allocations = Object.entries(amounts)
      .filter(([, amount]) => amount > 0)
      .map(([rekeningStructureId, amountRupiah]) => ({ rekeningStructureId, amountRupiah }));

    if (allocations.length === 0) {
      setBusy(false);
      setError("Isi minimal satu nominal rekening.");
      return;
    }

    const result = await setPartialAllocations({ taggingId, allocations });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg bg-surface rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-ink">Alokasi Rekening — {themeName}</div>
          <button onClick={onClose} aria-label="Tutup">
            <X size={18} className="text-muted" />
          </button>
        </div>
        <p className="text-xs text-muted mt-2">
          Nominal Rupiah per rekening yang mendukung tema ini (PRD 5.7.3).
        </p>

        {loading ? (
          <div className="text-sm text-faint py-6 text-center">Memuat rekening…</div>
        ) : (
          <div className="flex flex-col gap-2 mt-4 max-h-80 overflow-y-auto">
            {rekeningOptions.map((r) => (
              <div key={r._id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-ink truncate">{r.name}</div>
                  <div className="text-[10px] font-mono text-faint">Pagu {rp(r.pagu)} · Realisasi {rp(r.realisasi)}</div>
                </div>
                <input
                  type="number"
                  min={0}
                  placeholder="Rp 0"
                  value={amounts[r._id] ?? ""}
                  onChange={(e) => setAmounts((prev) => ({ ...prev, [r._id]: Number(e.target.value) }))}
                  className="w-32 px-2 py-1.5 rounded-lg border border-border text-xs font-mono"
                />
              </div>
            ))}
            {rekeningOptions.length === 0 && (
              <div className="text-sm text-faint py-4 text-center">
                Belum ada rekening di bawah subkegiatan ini.
              </div>
            )}
          </div>
        )}

        {error && <div className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2 mt-3">{error}</div>}
        <div className="flex gap-3 mt-5">
          <button
            disabled={busy || loading}
            onClick={submit}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "Menyimpan…" : "Simpan Alokasi"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted">
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
