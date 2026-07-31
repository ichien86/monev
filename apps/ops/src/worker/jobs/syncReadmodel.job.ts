import type Agenda from "agenda";
import {
  getIndicatorModel,
  getFinalValueModel,
  getSubmissionModel,
  getReadmodelSnapshotModel,
  getThemeModel,
  getTaggingModel,
  getBudgetStructureModel,
} from "@simonev/db";
import { calculateCapaian, resolveTargetForYear, parseNumeric } from "@/lib/capaian";

/**
 * Menghitung agregat dari simonev_core dan menulis SATU dokumen snapshot baru
 * ke simonev_readmodel (DDT Section 6.3). SIMONEV Eksekutif hanya membaca
 * dokumen terbaru dari koleksi ini — tidak pernah menjalankan agregasi sendiri.
 */
export const SYNC_READMODEL_JOB = "sync-readmodel";

export function defineSyncReadmodelJob(agenda: Agenda) {
  agenda.define(SYNC_READMODEL_JOB, async () => {
    const IndicatorModel = await getIndicatorModel();
    const FinalValueModel = await getFinalValueModel();
    const SubmissionModel = await getSubmissionModel();
    const SnapshotModel = await getReadmodelSnapshotModel();
    const ThemeModel = await getThemeModel();
    const TaggingModel = await getTaggingModel();
    const BudgetStructureModel = await getBudgetStructureModel();

    const currentYear = new Date().getFullYear();

    const [sasaranStrategisDaerah, indikatorUtama, programIndicators] = await Promise.all([
      IndicatorModel.countDocuments({ tier: "SASARAN_STRATEGIS_DAERAH", isActive: true }),
      IndicatorModel.countDocuments({ classificationTags: "IKU", isActive: true }),
      IndicatorModel.find({ tier: "SASARAN_PROGRAM", isActive: true })
        .select("_id targets polarity allowOverachievement calculationMethod")
        .lean(),
    ]);
    const programPerangkatDaerah = programIndicators.length;

    // F-08/F-11 — Kalkulasi Capaian (PRD 5.5). Untuk setiap indikator Sasaran
    // Program yang punya FinalValue tahun berjalan, hitung capaian% nyata
    // (mempertimbangkan polaritas & capping overachievement) lewat
    // apps/ops/src/lib/capaian.ts. Indikator "kumulatif" dijumlahkan dari
    // seluruh FinalValue tahun berjalan; selain itu memakai FinalValue
    // periode terakhir (diasumsikan dokumen paling baru diinput = periode
    // terakhir, karena Submission/FinalValue tidak menyimpan urutan periode
    // eksplisit di luar label teks — batasan yang sama diwarisi dari PRD 5.4).
    const indicatorsById = new Map(programIndicators.map((i) => [i._id.toString(), i]));
    const finalValuesThisYear = await FinalValueModel.find({
      periodYear: currentYear,
      indicatorId: { $in: programIndicators.map((i) => i._id) },
    })
      .sort({ approvedAt: 1 })
      .lean();

    const valuesByIndicator = new Map<string, typeof finalValuesThisYear>();
    for (const fv of finalValuesThisYear) {
      const key = fv.indicatorId.toString();
      if (!valuesByIndicator.has(key)) valuesByIndicator.set(key, []);
      valuesByIndicator.get(key)!.push(fv);
    }

    let tercapai = 0;
    let proses = 0;
    let belumTercapai = 0;

    for (const [indicatorId, values] of valuesByIndicator) {
      const indicator = indicatorsById.get(indicatorId);
      if (!indicator) continue;

      const isCumulative = indicator.calculationMethod === "sum";
      const representativeValue = isCumulative
        ? values.reduce((sum, v) => sum + (parseNumeric(v.value) ?? 0), 0).toString()
        : values[values.length - 1].value; // periode terakhir (lihat catatan di atas)

      const target = resolveTargetForYear(
        (indicator.targets ?? []).map((t) => ({ year: t.year, value: t.value })),
        currentYear
      );
      if (!target) continue;

      const result = calculateCapaian(
        representativeValue,
        target,
        (indicator.polarity as "positive" | "negative") ?? "positive",
        indicator.allowOverachievement ?? false
      );
      if (!result) continue;

      if (result.status === "tercapai") tercapai += 1;
      else if (result.status === "proses") proses += 1;
      else belumTercapai += 1;
    }

    const reportedIndicatorIds = await SubmissionModel.distinct("indicatorId", {
      periodYear: currentYear,
      status: { $in: ["menunggu_bapperida", "disetujui"] },
    });
    const belumLaporPeriodeIni = await IndicatorModel.countDocuments({
      tier: "SASARAN_PROGRAM",
      isActive: true,
      _id: { $nin: reportedIndicatorIds },
    });

    // F-02: rekap pagu ter-tag per tema (PRD 5.6) — SENGAJA tidak di-dedup
    // lintas tema (overlap dipertahankan apa adanya, lihat Tagging.ts).
    const [themes, taggings, structures] = await Promise.all([
      ThemeModel.find({ isActive: true }).lean(),
      TaggingModel.find({ budgetYear: currentYear }).lean(),
      BudgetStructureModel.find({ budgetYear: currentYear }).select("pagu").lean(),
    ]);
    const paguByStructureId = new Map(structures.map((s) => [s._id.toString(), s.pagu]));

    const temaSummary = themes.map((theme) => {
      const themeTaggings = taggings.filter((t) => t.themeId.toString() === theme._id.toString());
      const paguTerTag = themeTaggings.reduce((sum, t) => {
        const pagu = paguByStructureId.get(t.budgetStructureId.toString()) ?? 0;
        if (t.coverage === "penuh") return sum + pagu;
        return sum + pagu * ((t.coveragePercent ?? 0) / 100);
      }, 0);
      return {
        themeId: theme._id,
        themeName: theme.name,
        colorHex: theme.colorHex,
        paguTerTag,
        jumlahProgram: themeTaggings.length,
      };
    });

    await SnapshotModel.create({
      generatedAt: new Date(),
      statusDistribution: { tercapai, proses, belumTercapai },
      totals: {
        sasaranStrategisDaerah,
        indikatorUtama,
        programPerangkatDaerah,
        belumLaporPeriodeIni,
      },
      temaSummary,
    });

    console.log(`[${SYNC_READMODEL_JOB}] Snapshot baru ditulis ke simonev_readmodel.`);
  });
}
