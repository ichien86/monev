"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Plus, Trash2 } from "lucide-react";
import {
  createIndicatorSchema,
  TIER_ORDER,
  INDICATOR_TIER_VALUES,
  type CreateIndicatorInput,
} from "@simonev/schemas";
import { createIndicator } from "./actions";

const TIER_LABEL: Record<string, string> = {
  VISI: "Visi",
  MISI: "Misi",
  TUJUAN_DAERAH: "Tujuan Daerah",
  SASARAN_STRATEGIS_DAERAH: "Sasaran Strategis Daerah",
  TUJUAN_PD: "Tujuan PD",
  SASARAN_STRATEGIS_PD: "Sasaran Strategis PD",
  SASARAN_PROGRAM: "Sasaran Program",
};

/** Tingkat anak yang sah diturunkan otomatis dari tingkat induk (PRD 5.1) —
 *  pengguna tidak diberi pilihan bebas supaya pelanggaran hierarki tidak
 *  mungkin terjadi lewat UI, bukan cuma dicegah di Server Action. */
function childTierOf(parentTier: string | null): string {
  if (!parentTier) return "VISI";
  const rank = TIER_ORDER[parentTier as keyof typeof TIER_ORDER] + 1;
  return INDICATOR_TIER_VALUES[rank] ?? INDICATOR_TIER_VALUES[INDICATOR_TIER_VALUES.length - 1];
}

export function IndicatorForm({
  parentId,
  parentTier,
  orgUnits,
  onClose,
  onCreated,
}: {
  parentId: string | null;
  parentTier: string | null;
  orgUnits: { _id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const tier = childTierOf(parentTier);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateIndicatorInput>({
    resolver: zodResolver(createIndicatorSchema),
    defaultValues: {
      tier: tier as CreateIndicatorInput["tier"],
      parentId,
      label: "",
      calculationMethod: "last_period",
      polarity: "positive",
      allowOverachievement: false,
      periodicity: "tahunan",
      targets: [],
      classificationTags: [],
      crossCuttingWorkUnitIds: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "targets" });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await createIndicator(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    onCreated();
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg bg-surface rounded-xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-mono text-muted uppercase tracking-wide">
              Tambah node baru
            </div>
            <h2 className="font-display text-lg font-semibold text-ink mt-0.5">
              {TIER_LABEL[tier]}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Tutup">
            <X size={18} className="text-muted" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-mono text-muted uppercase tracking-wide">Label</span>
            <textarea
              {...register("label")}
              rows={3}
              className="px-3 py-2 rounded-lg border border-border text-sm"
            />
            {errors.label && <span className="text-xs text-danger">{errors.label.message}</span>}
          </label>

          {tier === "SASARAN_PROGRAM" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-mono text-muted uppercase tracking-wide">
                    Metode Perhitungan
                  </span>
                  <select {...register("calculationMethod")} className="px-3 py-2 rounded-lg border border-border text-sm">
                    <option value="last_period">Nilai Periode Terakhir</option>
                    <option value="sum">Kumulatif (Dijumlahkan)</option>
                    <option value="average">Rata-rata</option>
                    <option value="weighted_sum">Weighted Sum</option>
                    <option value="categorical">Kategorikal</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-mono text-muted uppercase tracking-wide">Polaritas</span>
                  <select {...register("polarity")} className="px-3 py-2 rounded-lg border border-border text-sm">
                    <option value="positive">Positif (makin tinggi makin baik)</option>
                    <option value="negative">Negatif (makin rendah makin baik)</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-mono text-muted uppercase tracking-wide">Periodisitas</span>
                  <select {...register("periodicity")} className="px-3 py-2 rounded-lg border border-border text-sm">
                    <option value="bulanan">Bulanan</option>
                    <option value="triwulanan">Triwulanan</option>
                    <option value="semesteran">Semesteran</option>
                    <option value="tahunan">Tahunan</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-mono text-muted uppercase tracking-wide">Satuan</span>
                  <input {...register("unit")} placeholder="%, Poin, Rp Juta…" className="px-3 py-2 rounded-lg border border-border text-sm" />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("allowOverachievement")} />
                Izinkan overachievement (capping 120%)
              </label>

              <div>
                <span className="text-xs font-mono text-muted uppercase tracking-wide">
                  OPD Cross-Cutting (F-05, opsional)
                </span>
                <div className="text-[11px] text-faint mt-0.5 mb-2">
                  OPD di luar penanggung jawab utama yang juga berhak melapor untuk indikator ini.
                </div>
                <div className="flex flex-wrap gap-2">
                  {orgUnits.map((unit) => (
                    <label
                      key={unit._id}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border text-xs"
                    >
                      <input type="checkbox" value={unit._id} {...register("crossCuttingWorkUnitIds")} />
                      {unit.name}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted uppercase tracking-wide">Target per Tahun</span>
                  <button
                    type="button"
                    onClick={() => append({ year: new Date().getFullYear(), value: "" })}
                    className="flex items-center gap-1 text-xs font-semibold text-primary"
                  >
                    <Plus size={12} /> Tambah
                  </button>
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2">
                      <input
                        type="number"
                        {...register(`targets.${index}.year` as const, { valueAsNumber: true })}
                        className="w-24 px-3 py-2 rounded-lg border border-border text-sm font-mono"
                      />
                      <input
                        {...register(`targets.${index}.value` as const)}
                        placeholder="Nilai target"
                        className="flex-1 px-3 py-2 rounded-lg border border-border text-sm"
                      />
                      <button type="button" onClick={() => remove(index)} aria-label="Hapus">
                        <Trash2 size={16} className="text-danger" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {serverError && (
            <div className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{serverError}</div>
          )}

          <div className="flex gap-3 mt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
            >
              {isSubmitting ? "Menyimpan…" : "Simpan"}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted">
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
