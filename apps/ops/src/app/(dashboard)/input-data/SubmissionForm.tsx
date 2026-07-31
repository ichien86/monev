"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { createSubmissionSchema, type CreateSubmissionInput } from "@simonev/schemas";
import { createSubmission } from "./actions";

type IndicatorOption = { _id: string; label: string };

export function SubmissionForm({ indicatorOptions }: { indicatorOptions: IndicatorOption[] }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateSubmissionInput>({
    // workUnitId diisi otomatis di Server Action dari session — di form ini
    // hanya placeholder supaya resolver tidak menolak sebelum submit.
    resolver: zodResolver(createSubmissionSchema),
    defaultValues: { workUnitId: "placeholder", periodYear: new Date().getFullYear() },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await createSubmission(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    reset();
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono text-muted uppercase tracking-wide">Indikator</span>
          <select {...register("indicatorId")} className="px-3 py-2 rounded-lg border border-border text-sm">
            <option value="">— Pilih indikator —</option>
            {indicatorOptions.map((opt) => (
              <option key={opt._id} value={opt._id}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.indicatorId && <span className="text-xs text-danger">{errors.indicatorId.message}</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono text-muted uppercase tracking-wide">Periode</span>
          <div className="flex gap-2">
            <input
              type="number"
              {...register("periodYear", { valueAsNumber: true })}
              className="w-24 px-3 py-2 rounded-lg border border-border text-sm font-mono"
            />
            <input
              {...register("periodLabel")}
              placeholder="cth. Triwulan II"
              className="flex-1 px-3 py-2 rounded-lg border border-border text-sm"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono text-muted uppercase tracking-wide">Nilai Realisasi</span>
          <input {...register("reportedValue")} className="px-3 py-2 rounded-lg border border-border text-sm font-mono" />
          {errors.reportedValue && <span className="text-xs text-danger">{errors.reportedValue.message}</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono text-muted uppercase tracking-wide">Link Bukti</span>
          <input
            {...register("evidenceLink")}
            placeholder="https://drive.google.com/…"
            className="px-3 py-2 rounded-lg border border-border text-sm"
          />
          {errors.evidenceLink && <span className="text-xs text-danger">{errors.evidenceLink.message}</span>}
        </label>
      </div>
      {serverError && <div className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{serverError}</div>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
      >
        {isSubmitting ? "Mengirim…" : "Kirim untuk Divalidasi"}
      </button>
    </form>
  );
}
