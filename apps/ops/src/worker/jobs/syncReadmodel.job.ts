import type Agenda from "agenda";
import {
  getIndicatorModel,
  getVariableFinalValueModel,
  getReadmodelSnapshotModel,
  getThemeModel,
  getTaggingModel,
  getBudgetStructureModel,
} from "@simonev/db";
import { calculateCapaian, resolveTargetForYear, computeIndicatorValue, representativeValueForYear } from "@/lib/capaian";
import { getTahunAktif } from "@/lib/system-setting";

/**
 * Menghitung agregat dari simonev_core dan menulis SATU dokumen snapshot baru
 * ke simonev_readmodel (DDT Section 6.3). SIMONEV Eksekutif TIDAK PERNAH
 * menjalankan agregasi langsung ke data transaksi — hanya membaca dokumen
 * terbaru dari koleksi ini.
 *
 * DDT v2.0 — dirombak total: nilai indikator sekarang SELALU turunan dari
 * VariableFinalValue lewat computeIndicatorValue() (DDT 3.2), bukan dibaca
 * langsung dari FinalValue level-indikator (v1.0, sudah dihapus).
 */
export const SYNC_READMODEL_JOB = "sync-readmodel";

export function defineSyncReadmodelJob(agenda: Agenda) {
  agenda.define(SYNC_READMODEL_JOB, async () => {
    const IndicatorModel = await getIndicatorModel();
    const VariableFinalValueModel = await getVariableFinalValueModel();
    const SnapshotModel = await getReadmodelSnapshotModel();
    const ThemeModel = await getThemeModel();
    const TaggingModel = await getTaggingModel();
    const BudgetStructureModel = await getBudgetStructureModel();

    const tahunAktif = await getTahunAktif();

    const [sasaranStrategisDaerah, indikatorUtama, programIndicators] = await Promise.all([
      IndicatorModel.countDocuments({ tier: "SASARAN_STRATEGIS_DAERAH", isActive: true }),
      IndicatorModel.countDocuments({ classificationTags: "IKU", isActive: true }),
      IndicatorModel.find({ tier: "SASARAN_PROGRAM", isActive: true })
        .select("_id formula categories calculationMethod targets polarity allowOverachievement rpjmdCumulative")
        .lean(),
    ]);
    const programPerangkatDaerah = programIndicators.length;

    // Ambil seluruh VariableFinalValue tahun berjalan untuk variabel yang
    // dipakai formula indikator-indikator ini (satu query, bukan per-indikator).
    const allVariableIds = Array.from(
      new Set(programIndicators.flatMap((i) => i.formula.map((f) => f.variableId.toString())))
    );
    const finalValuesThisYear = await VariableFinalValueModel.find({
      periodYear: tahunAktif,
      variableId: { $in: allVariableIds },
    })
      .sort({ approvedAt: 1 })
      .lean();

    const valuesByVariable = new Map<string, typeof finalValuesThisYear>();
    for (const fv of finalValuesThisYear) {
      const key = fv.variableId.toString();
      if (!valuesByVariable.has(key)) valuesByVariable.set(key, []);
      valuesByVariable.get(key)!.push(fv);
    }

    let tercapai = 0;
    let proses = 0;
    let belumTercapai = 0;
    let belumLaporPeriodeIni = 0;

    for (const indicator of programIndicators) {
      const finalValuesByVariableId = new Map<string, string>();
      for (const entry of indicator.formula) {
        const key = entry.variableId.toString();
        const representative = representativeValueForYear(
          valuesByVariable.get(key) ?? [],
          indicator.rpjmdCumulative
        );
        if (representative !== null) finalValuesByVariableId.set(key, representative);
      }

      const computed = computeIndicatorValue(indicator, finalValuesByVariableId);
      if (!computed || computed.status === "belum_lengkap") {
        belumLaporPeriodeIni += 1;
        continue;
      }

      let capaianPercent: number;
      if (computed.kind === "kategorikal") {
        capaianPercent = computed.capaianPercent;
      } else {
        const target = resolveTargetForYear(
          (indicator.targets ?? []).map((t) => ({ year: t.year, value: t.value })),
          tahunAktif
        );
        if (!target) continue;
        const result = calculateCapaian(
          computed.value,
          target,
          (indicator.polarity as "positive" | "negative") ?? "positive",
          indicator.allowOverachievement ?? false
        );
        if (!result) continue;
        capaianPercent = result.capaianPercent;
      }

      if (capaianPercent >= 100) tercapai += 1;
      else if (capaianPercent >= 75) proses += 1;
      else belumTercapai += 1;
    }

    // F-02/F-07 — rekap pagu+realisasi ter-tag per tema (PRD 5.6/5.7).
    // DDT v2.0 — `partialAllocations` sudah berupa nominal Rupiah langsung
    // (bukan persentase dari pagu lagi), jadi tidak perlu lagi mengalikan
    // dengan pagu induk. SENGAJA tidak di-dedup lintas tema (overlap
    // dipertahankan apa adanya, lihat Tagging.ts).
    const [themes, taggings, structures] = await Promise.all([
      ThemeModel.find({ isActive: true }).lean(),
      TaggingModel.find({ budgetYear: tahunAktif }).lean(),
      BudgetStructureModel.find({ budgetYear: tahunAktif }).select("pagu").lean(),
    ]);
    const paguByStructureId = new Map(structures.map((s) => [s._id.toString(), s.pagu]));

    const temaSummary = themes.map((theme) => {
      const themeTaggings = taggings.filter((t) => t.themeId.toString() === theme._id.toString());
      const paguTerTag = themeTaggings.reduce((sum, t) => {
        if (t.coverage === "penuh") {
          return sum + (paguByStructureId.get(t.budgetStructureId.toString()) ?? 0);
        }
        const partialSum = (t.partialAllocations ?? []).reduce((s, a) => s + a.amountRupiah, 0);
        return sum + partialSum;
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
