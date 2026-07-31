"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createTheme } from "./actions";

type Theme = { _id: string; name: string; colorHex: string };

export function ThemeManager({
  themes,
  activeTema,
  toggleTema,
  canManage,
}: {
  themes: Theme[];
  activeTema: Set<string>;
  toggleTema: (id: string) => void;
  canManage: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#4A6FA5");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await createTheme({ name, colorHex: color });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName("");
    setAdding(false);
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-mono text-muted uppercase tracking-wide">Filter Tema</span>
      {themes.map((t) => {
        const on = activeTema.has(t._id);
        return (
          <button
            key={t._id}
            onClick={() => toggleTema(t._id)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
            style={{
              borderColor: on ? t.colorHex : "#E3E6E0",
              background: on ? `${t.colorHex}14` : "transparent",
              opacity: on ? 1 : 0.5,
            }}
          >
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: t.colorHex }} />
            <span className="text-xs font-semibold text-ink">{t.name}</span>
          </button>
        );
      })}

      {canManage && !adding && (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-border text-xs text-muted"
        >
          <Plus size={12} /> Tema Baru
        </button>
      )}

      {canManage && adding && (
        <div className="flex items-center gap-2 bg-surface border border-border rounded-full px-2 py-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama tema…"
            className="text-xs px-2 py-1 w-32 outline-none"
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-6 h-6 rounded"
          />
          <button
            disabled={busy || name.length < 3}
            onClick={submit}
            className="text-xs font-semibold text-primary disabled:opacity-40"
          >
            Simpan
          </button>
          <button onClick={() => setAdding(false)} className="text-xs text-muted">
            ×
          </button>
        </div>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
