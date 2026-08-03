"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { createOrgUnitSchema, type CreateOrgUnitInput } from "@simonev/schemas";
import { createOrgUnit } from "./actions";

type BidangUrusanOption = { _id: string; name: string; urusanName: string };

export function OrgUnitForm({ bidangUrusanOptions }: { bidangUrusanOptions: BidangUrusanOption[] }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrgUnitInput>({
    resolver: zodResolver(createOrgUnitSchema),
    defaultValues: { name: "", sipdCode: "", bidangUrusanIds: [], isExternal: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
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
          <span className="text-xs font-mono text-muted uppercase tracking-wide">Nama PD</span>
          <input {...register("name")} className="px-3 py-2 rounded-lg border border-border text-sm" />
          {errors.name && <span className="text-xs text-danger">{errors.name.message}</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono text-muted uppercase tracking-wide">Kode SIPD</span>
          <input {...register("sipdCode")} className="px-3 py-2 rounded-lg border border-border text-sm font-mono" />
          {errors.sipdCode && <span className="text-xs text-danger">{errors.sipdCode.message}</span>}
        </label>
      </div>

      <div>
        <span className="text-xs font-mono text-muted uppercase tracking-wide">
          Bidang Urusan (maks. 3, PRD 5.9)
        </span>
        <div className="flex flex-wrap gap-2 mt-2">
          {bidangUrusanOptions.map((b) => (
            <label
              key={b._id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border text-xs"
              title={b.urusanName}
            >
              <input type="checkbox" value={b._id} {...register("bidangUrusanIds")} />
              {b.name}
            </label>
          ))}
          {bidangUrusanOptions.length === 0 && (
            <span className="text-xs text-faint">Belum ada data referensi Bidang Urusan (jalankan seed).</span>
          )}
        </div>
        {errors.bidangUrusanIds && (
          <span className="text-xs text-danger block mt-1">{errors.bidangUrusanIds.message}</span>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("isExternal")} />
        PD Eksternal (mis. BPS, Kemenag — PRD 5.9.2)
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
