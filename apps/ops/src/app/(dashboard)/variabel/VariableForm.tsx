"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { createVariableSchema, type CreateVariableInput } from "@simonev/schemas";
import { createVariable } from "./actions";

export function VariableForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateVariableInput>({
    resolver: zodResolver(createVariableSchema),
    defaultValues: { name: "", unit: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await createVariable(values);
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
          <span className="text-xs font-mono text-muted uppercase tracking-wide">Nama Variabel</span>
          <input {...register("name")} className="px-3 py-2 rounded-lg border border-border text-sm" />
          {errors.name && <span className="text-xs text-danger">{errors.name.message}</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono text-muted uppercase tracking-wide">Satuan</span>
          <input {...register("unit")} placeholder="orang, unit, %, dst." className="px-3 py-2 rounded-lg border border-border text-sm" />
          {errors.unit && <span className="text-xs text-danger">{errors.unit.message}</span>}
        </label>
      </div>
      {serverError && <div className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{serverError}</div>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
      >
        {isSubmitting ? "Menyimpan…" : "Tambah Variabel"}
      </button>
    </form>
  );
}
