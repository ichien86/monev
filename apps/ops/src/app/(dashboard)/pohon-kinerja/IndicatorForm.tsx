"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Plus, Trash2 } from "lucide-react";
import {
  createIndicatorSchema,
  TIER_ORDER,
  INDICATOR_TIER_VALUES,
  CALCULATION_METHOD_VALUES,
  FORMULA_ROLE_VALUES,
  CROSS_CUTTING_TYPE_VALUES,
  SPLIT_CONFIG_MODE_VALUES,
  VARIABLE_DATA_SOURCE_TYPE_VALUES,
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

const CALCULATION_METHOD_LABEL: Record<string, string> = {
  variabel_tunggal: "Variabel Tunggal",
  persentase: "Persentase (pembilang ÷ penyebut × 100)",
  penjumlahan: "Penjumlahan",
  rata_rata: "Rata-rata",
  penjumlahan_berbobot: "Penjumlahan Berbobot",
  selisih: "Selisih",
  rasio: "Rasio (pembilang ÷ penyebut)",
  kategorikal: "Kategorikal",
};

const FORMULA_ROLE_LABEL: Record<string, string> = {
  tunggal: "Tunggal",
  pembilang: "Pembilang",
  penyebut: "Penyebut",
  komponen: "Komponen",
  pengurang: "Pengurang",
};

/** Tingkat anak yang sah diturunkan otomatis dari tingkat induk (PRD 5.1) —
 *  pengguna tidak diberi pilihan bebas supaya pelanggaran hierarki tidak
 *  mungkin terjadi lewat UI, bukan cuma dicegah di Server Action. */
function childTierOf(parentTier: string | null): string {
  if (!parentTier) return "VISI";
  const rank = TIER_ORDER[parentTier as keyof typeof TIER_ORDER] + 1;
  return INDICATOR_TIER_VALUES[rank] ?? INDICATOR_TIER_VALUES[INDICATOR_TIER_VALUES.length - 1];
}

type VariableOption = { _id: string; name: string; unit: string };
type OrgUnitOption = { _id: string; name: string };
type BudgetProgramOption = { _id: string; name: string; sipdCode: string };

export function IndicatorForm({
  parentId,
  parentTier,
  orgUnits,
  variables,
  budgetPrograms,
  onClose,
  onCreated,
}: {
  parentId: string | null;
  parentTier: string | null;
  orgUnits: OrgUnitOption[];
  variables: VariableOption[];
  budgetPrograms: BudgetProgramOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const tier = childTierOf(parentTier);
  const isSasaranProgram = tier === "SASARAN_PROGRAM";

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateIndicatorInput>({
    resolver: zodResolver(createIndicatorSchema),
    defaultValues: {
      tier: tier as CreateIndicatorInput["tier"],
      parentId,
      label: "",
      calculationMethod: "variabel_tunggal",
      formula: [],
      categories: [],
      crossCutting: { type: null, primaryWorkUnitId: null, workUnitIds: [], splitConfig: [] },
      linkedProgramId: null,
      rpjmdCumulative: false,
      variableSources: [],
      polarity: "positive",
      allowOverachievement: false,
      periodicity: "tahunan",
      targets: [],
      classificationTags: [],
    },
  });

  const formula = useFieldArray({ control, name: "formula" });
  const categories = useFieldArray({ control, name: "categories" });
  const splitConfig = useFieldArray({ control, name: "crossCutting.splitConfig" });
  const targets = useFieldArray({ control, name: "targets" });

  const calculationMethod = watch("calculationMethod");
  const crossCuttingType = watch("crossCutting.type");
  // useWatch (bukan watch()) -- watch() tidak konsisten memicu render ulang
  // saat leaf field DI DALAM array berubah (mis. formula.0.variableId lewat
  // <select>), hanya saat array itu sendiri tumbuh/menyusut lewat useFieldArray.
  const formulaValues = useWatch({ control, name: "formula" });

  // Baris "Sumber Data per Variabel" tidak punya input variableId sendiri --
  // selalu mengikuti variableId di baris formula yang sejajar (sama indeks).
  // Disinkron lewat setValue (bukan input hidden ber-`value`, yang tidak
  // pernah benar-benar diperbarui di state RHF) supaya zodResolver melihat
  // nilai yang benar SAAT validasi berjalan, bukan cuma saat submit --
  // kalau tidak, validasi gagal diam-diam (field ini tidak punya pesan error
  // yang ditampilkan) dan form tidak pernah terkirim ke server.
  useEffect(() => {
    formulaValues?.forEach((f, index) => {
      setValue(`variableSources.${index}.variableId`, f.variableId ?? "", { shouldValidate: false });
    });
  }, [formulaValues, setValue]);

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
      <div className="w-full max-w-2xl bg-surface rounded-xl p-6 max-h-[90vh] overflow-y-auto">
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

          {isSasaranProgram && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-mono text-muted uppercase tracking-wide">
                  Program Terkait (F-01 5.1.6, wajib)
                </span>
                <select {...register("linkedProgramId")} className="px-3 py-2 rounded-lg border border-border text-sm">
                  <option value="">— Pilih Program —</option>
                  {budgetPrograms.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.sipdCode})
                    </option>
                  ))}
                </select>
                {errors.linkedProgramId && (
                  <span className="text-xs text-danger">{errors.linkedProgramId.message}</span>
                )}
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-mono text-muted uppercase tracking-wide">
                    Metode Perhitungan
                  </span>
                  <select {...register("calculationMethod")} className="px-3 py-2 rounded-lg border border-border text-sm">
                    {CALCULATION_METHOD_VALUES.map((m) => (
                      <option key={m} value={m}>
                        {CALCULATION_METHOD_LABEL[m]}
                      </option>
                    ))}
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
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("rpjmdCumulative")} />
                Akumulatif untuk Periode RPJMD (PRD 5.6.2)
              </label>

              {/* --- Formula (DDT v2.0 Section 2.2/3.2) --- */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted uppercase tracking-wide">
                    Formula — Variabel Pembentuk
                  </span>
                  <button
                    type="button"
                    onClick={() => formula.append({ variableId: "", role: "tunggal", weight: null })}
                    className="flex items-center gap-1 text-xs font-semibold text-primary"
                  >
                    <Plus size={12} /> Tambah Variabel
                  </button>
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  {formula.fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-center">
                      <select
                        {...register(`formula.${index}.variableId` as const)}
                        className="flex-1 px-3 py-2 rounded-lg border border-border text-sm"
                      >
                        <option value="">— Pilih variabel —</option>
                        {variables.map((v) => (
                          <option key={v._id} value={v._id}>
                            {v.name} ({v.unit})
                          </option>
                        ))}
                      </select>
                      <select
                        {...register(`formula.${index}.role` as const)}
                        className="w-36 px-3 py-2 rounded-lg border border-border text-sm"
                      >
                        {FORMULA_ROLE_VALUES.map((r) => (
                          <option key={r} value={r}>
                            {FORMULA_ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                      {calculationMethod === "penjumlahan_berbobot" && (
                        <input
                          type="number"
                          placeholder="Bobot %"
                          {...register(`formula.${index}.weight` as const, { valueAsNumber: true })}
                          className="w-24 px-3 py-2 rounded-lg border border-border text-sm font-mono"
                        />
                      )}
                      <button type="button" onClick={() => formula.remove(index)} aria-label="Hapus">
                        <Trash2 size={16} className="text-danger" />
                      </button>
                    </div>
                  ))}
                  {formula.fields.length === 0 && (
                    <div className="text-xs text-faint">Belum ada variabel di formula ini.</div>
                  )}
                </div>
              </div>

              {/* --- Kategori (calculationMethod="kategorikal") --- */}
              {calculationMethod === "kategorikal" && (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted uppercase tracking-wide">
                      Kategori → Capaian% (DDT v2.0 3.2)
                    </span>
                    <button
                      type="button"
                      onClick={() => categories.append({ label: "", capaianPercent: 0 })}
                      className="flex items-center gap-1 text-xs font-semibold text-primary"
                    >
                      <Plus size={12} /> Tambah Kategori
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 mt-2">
                    {categories.fields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <input
                          placeholder="Label kategori"
                          {...register(`categories.${index}.label` as const)}
                          className="flex-1 px-3 py-2 rounded-lg border border-border text-sm"
                        />
                        <input
                          type="number"
                          placeholder="Capaian%"
                          {...register(`categories.${index}.capaianPercent` as const, { valueAsNumber: true })}
                          className="w-28 px-3 py-2 rounded-lg border border-border text-sm font-mono"
                        />
                        <button type="button" onClick={() => categories.remove(index)} aria-label="Hapus">
                          <Trash2 size={16} className="text-danger" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* --- Sumber Data per Variabel (PRD 5.2.3) --- */}
              {formula.fields.length > 0 && (
                <div>
                  <span className="text-xs font-mono text-muted uppercase tracking-wide">
                    Sumber Data per Variabel (opsional, default manual)
                  </span>
                  <div className="flex flex-col gap-2 mt-2">
                    {formula.fields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-center text-xs">
                        <span className="w-40 truncate text-muted">
                          {variables.find((v) => v._id === watch(`formula.${index}.variableId`))?.name ?? "(pilih variabel)"}
                        </span>
                        <select
                          {...register(`variableSources.${index}.sourceType` as const)}
                          defaultValue="manual"
                          className="px-2 py-1.5 rounded-lg border border-border text-xs"
                        >
                          {VARIABLE_DATA_SOURCE_TYPE_VALUES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        {watch(`variableSources.${index}.sourceType`) === "api" && (
                          <input
                            placeholder="apiConnectorKey"
                            {...register(`variableSources.${index}.apiConnectorKey` as const)}
                            className="flex-1 px-2 py-1.5 rounded-lg border border-border text-xs font-mono"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* --- Cross-Cutting (F-05, DDT v2.0 3.3) --- */}
              <div>
                <span className="text-xs font-mono text-muted uppercase tracking-wide">
                  Target Silang Sektor (F-05, opsional)
                </span>
                <select {...register("crossCutting.type")} className="mt-1.5 px-3 py-2 rounded-lg border border-border text-sm">
                  <option value="">Tidak cross-cutting</option>
                  {CROSS_CUTTING_TYPE_VALUES.map((t) => (
                    <option key={t} value={t}>
                      Tipe {t === "berbagi" ? "Berbagi" : "Terpisah"}
                    </option>
                  ))}
                </select>

                {crossCuttingType && (
                  <div className="mt-2 flex flex-col gap-2">
                    <div>
                      <div className="text-[11px] text-faint mb-1">PD terlibat</div>
                      <div className="flex flex-wrap gap-2">
                        {orgUnits.map((unit) => (
                          <label
                            key={unit._id}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border text-xs"
                          >
                            <input type="checkbox" value={unit._id} {...register("crossCutting.workUnitIds")} />
                            {unit.name}
                          </label>
                        ))}
                      </div>
                    </div>

                    {crossCuttingType === "berbagi" && (
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[11px] text-faint">PD Primer</span>
                        <select {...register("crossCutting.primaryWorkUnitId")} className="px-3 py-2 rounded-lg border border-border text-sm">
                          <option value="">— Pilih PD primer —</option>
                          {orgUnits.map((unit) => (
                            <option key={unit._id} value={unit._id}>
                              {unit.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {crossCuttingType === "terpisah" && (
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-faint">
                            Konfigurasi per variabel (dijumlahkan / ditunjuk ke satu PD)
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              splitConfig.append({ variableId: "", mode: "dijumlahkan", designatedWorkUnitId: null })
                            }
                            className="flex items-center gap-1 text-xs font-semibold text-primary"
                          >
                            <Plus size={12} /> Tambah
                          </button>
                        </div>
                        <div className="flex flex-col gap-2 mt-2">
                          {splitConfig.fields.map((field, index) => (
                            <div key={field.id} className="flex gap-2 items-center">
                              <select
                                {...register(`crossCutting.splitConfig.${index}.variableId` as const)}
                                className="flex-1 px-2 py-1.5 rounded-lg border border-border text-xs"
                              >
                                <option value="">— Variabel —</option>
                                {variables.map((v) => (
                                  <option key={v._id} value={v._id}>
                                    {v.name}
                                  </option>
                                ))}
                              </select>
                              <select
                                {...register(`crossCutting.splitConfig.${index}.mode` as const)}
                                className="w-32 px-2 py-1.5 rounded-lg border border-border text-xs"
                              >
                                {SPLIT_CONFIG_MODE_VALUES.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                              <select
                                {...register(`crossCutting.splitConfig.${index}.designatedWorkUnitId` as const)}
                                className="flex-1 px-2 py-1.5 rounded-lg border border-border text-xs"
                              >
                                <option value="">— PD ditunjuk (jika mode ditunjuk) —</option>
                                {orgUnits.map((unit) => (
                                  <option key={unit._id} value={unit._id}>
                                    {unit.name}
                                  </option>
                                ))}
                              </select>
                              <button type="button" onClick={() => splitConfig.remove(index)} aria-label="Hapus">
                                <Trash2 size={14} className="text-danger" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted uppercase tracking-wide">Target per Tahun</span>
                  <button
                    type="button"
                    onClick={() => targets.append({ year: new Date().getFullYear(), value: "" })}
                    className="flex items-center gap-1 text-xs font-semibold text-primary"
                  >
                    <Plus size={12} /> Tambah
                  </button>
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  {targets.fields.map((field, index) => (
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
                      <button type="button" onClick={() => targets.remove(index)} aria-label="Hapus">
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
