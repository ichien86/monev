"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { createVariableSchema, type CreateVariableInput } from "@simonev/schemas";
import { createVariable, listVariables } from "./actions";

type VariableItem = {
  _id: string;
  name: string;
  code: string | null;
  unit: string | null;
  source: string | null;
  description: string | null;
};

export function VariableManager({
  initialVariables,
  canManage,
}: {
  initialVariables: VariableItem[];
  canManage: boolean;
}) {
  const [items, setItems] = useState<VariableItem[]>(initialVariables);
  const [query, setQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const result = await listVariables(value);
      setItems(result as unknown as VariableItem[]);
    }, 300);
  };

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateVariableInput>({
    resolver: zodResolver(createVariableSchema),
    defaultValues: { name: "", code: "", unit: "", source: "", description: "" },
  });
  const [serverError, setServerError] = useState<string | null>(null);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await createVariable(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    reset();
    const refreshed = await listVariables(query);
    setItems(refreshed as unknown as VariableItem[]);
  });

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <form onSubmit={onSubmit} className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-mono text-muted uppercase tracking-wide">Nama Variabel</span>
              <input {...register("name")} className="px-3 py-2 rounded-lg border border-border text-sm" />
              {errors.name && <span className="text-xs text-danger">{errors.name.message}</span>}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-mono text-muted uppercase tracking-wide">Kode (opsional)</span>
              <input {...register("code")} className="px-3 py-2 rounded-lg border border-border text-sm font-mono" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-mono text-muted uppercase tracking-wide">Satuan</span>
              <input {...register("unit")} placeholder="Tahun, %, Poin…" className="px-3 py-2 rounded-lg border border-border text-sm" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-mono text-muted uppercase tracking-wide">Sumber</span>
              <input {...register("source")} placeholder="BPS, SIPD, Manual…" className="px-3 py-2 rounded-lg border border-border text-sm" />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-mono text-muted uppercase tracking-wide">Deskripsi (opsional)</span>
            <input {...register("description")} className="px-3 py-2 rounded-lg border border-border text-sm" />
          </label>
          {serverError && <div className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{serverError}</div>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="self-start px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
          >
            {isSubmitting ? "Menyimpan…" : "Tambah Variabel"}
          </button>
        </form>
      )}

      <label className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Cari variabel (nama atau kode)…"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm"
        />
      </label>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg">
              {["Nama", "Kode", "Satuan", "Sumber"].map((h) => (
                <th key={h} className="text-left px-5 py-2.5 font-mono text-[10px] text-muted uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr key={v._id} className="border-t border-border">
                <td className="px-5 py-3 font-medium">{v.name}</td>
                <td className="px-5 py-3 font-mono text-xs text-muted">{v.code ?? "—"}</td>
                <td className="px-5 py-3 text-muted">{v.unit ?? "—"}</td>
                <td className="px-5 py-3 text-muted">{v.source ?? "—"}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-faint text-sm">
                  {query ? "Tidak ada variabel yang cocok." : "Belum ada data Variabel."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
