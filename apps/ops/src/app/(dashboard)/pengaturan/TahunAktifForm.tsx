"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setTahunAktif } from "./actions";

export function TahunAktifForm({ currentValue }: { currentValue: number }) {
  const router = useRouter();
  const [value, setValue] = useState(currentValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await setTahunAktif({ value });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
      <div>
        <div className="text-xs font-mono text-muted uppercase tracking-wide">Tahun Aktif Saat Ini</div>
        <div className="font-display text-3xl font-semibold text-ink mt-1">{currentValue}</div>
      </div>
      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono text-muted uppercase tracking-wide">Ubah ke</span>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-32 px-3 py-2 rounded-lg border border-border text-sm font-mono"
          />
        </label>
        <button
          disabled={busy}
          onClick={submit}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
      {error && <div className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{error}</div>}
    </div>
  );
}
