"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { createOrgUnitSchema, type CreateOrgUnitInput } from "@simonev/schemas";
import { createOrgUnit } from "./actions";

export function OrgUnitForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrgUnitInput>({
    resolver: zodResolver(createOrgUnitSchema),
    defaultValues: { name: "", sipdCode: "", urusan: [] },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    // Input urusan sebagai teks dipisah koma di form sederhana ini.
    const result = await createOrgUnit(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    reset();
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3 mb-6">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono text-muted uppercase tracking-wide">Nama OPD</span>
          <input {...register("name")} className="px-3 py-2 rounded-lg border border-border text-sm" />
          {errors.name && <span className="text-xs text-danger">{errors.name.message}</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono text-muted uppercase tracking-wide">Kode SIPD</span>
          <input {...register("sipdCode")} className="px-3 py-2 rounded-lg border border-border text-sm font-mono" />
          {errors.sipdCode && <span className="text-xs text-danger">{errors.sipdCode.message}</span>}
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-mono text-muted uppercase tracking-wide">
          Urusan (pisahkan dengan koma)
        </span>
        <input
          {...register("urusan", {
            setValueAs: (v: string) =>
              typeof v === "string"
                ? v.split(",").map((s) => s.trim()).filter(Boolean)
                : v,
          })}
          placeholder="Ketahanan Pangan, Pertanian"
          className="px-3 py-2 rounded-lg border border-border text-sm"
        />
      </label>
      {serverError && <div className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{serverError}</div>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
      >
        {isSubmitting ? "Menyimpan…" : "Tambah Perangkat Daerah"}
      </button>
    </form>
  );
}
