import type Agenda from "agenda";
import { getIndicatorModel, getVariableFinalValueModel, getUserModel } from "@simonev/db";
import { getConnector } from "@/lib/data-sources/registry";
import { getTahunAktif } from "@/lib/system-setting";
import { notify } from "@/lib/notify";
import { RECOMPUTE_INDICATOR_VALUE_JOB } from "./recomputeIndicatorValue.job";

export const PULL_EXTERNAL_SOURCES_JOB = "pull-external-sources";

/**
 * DDT v2.0 Section 3.5 — job berkala; dijadwalkan mengikuti buka-tutup
 * Jadwal Pengisian Realisasi. Realisasi dari sourceType satu_data/api SKIP
 * seluruh alur approval manusia (PRD 5.2.3 "langsung final") — ditulis
 * langsung ke VariableFinalValue.
 *
 * Penyederhanaan yang didokumentasikan eksplisit: job ini memakai Tahun
 * Aktif sebagai periodYear dan label tetap "Tahunan" untuk setiap tarikan —
 * belum mendukung periodisitas triwulanan/bulanan per Indicator. Cukup
 * untuk kebutuhan awal (kebanyakan sumber Satu Data/BPS bersifat tahunan);
 * upgrade ke periodisitas dinamis tinggal membaca `Indicator.periodicity`
 * milik indikator pemakai variabel tersebut kalau dibutuhkan nanti.
 */
export function definePullExternalSourcesJob(agenda: Agenda) {
  agenda.define(PULL_EXTERNAL_SOURCES_JOB, async () => {
    const IndicatorModel = await getIndicatorModel();
    const VariableFinalValueModel = await getVariableFinalValueModel();
    const UserModel = await getUserModel();

    const tahunAktif = await getTahunAktif();
    const periodLabel = "Tahunan";

    const indicators = await IndicatorModel.find({
      isActive: true,
      "variableSources.sourceType": { $in: ["satu_data", "api"] },
    })
      .select("variableSources ownerWorkUnitId")
      .lean();

    let pulled = 0;
    for (const indicator of indicators) {
      for (const source of indicator.variableSources ?? []) {
        if (source.sourceType === "manual") continue;

        const connectorKey = source.sourceType === "satu_data" ? "satu_data_boyolali" : source.apiConnectorKey;
        const connector = connectorKey ? getConnector(connectorKey) : null;
        if (!connector) continue;

        const result = await connector.fetchValue(source.variableId.toString(), tahunAktif, periodLabel);

        if (!result) {
          if (indicator.ownerWorkUnitId) {
            const recipients = await UserModel.find({
              workUnitId: indicator.ownerWorkUnitId,
              isActive: true,
            })
              .select("_id")
              .lean();
            for (const recipient of recipients) {
              await notify({
                userId: recipient._id.toString(),
                type: "warning",
                title: "Sumber data otomatis gagal ditarik",
                message: `Gagal mengambil data dari sumber "${connectorKey}" untuk periode ${periodLabel} ${tahunAktif}. Akan dicatat "Belum Input" jika jendela pengisian tertutup.`,
                link: "/pohon-kinerja",
              });
            }
          }
          continue;
        }

        await VariableFinalValueModel.findOneAndUpdate(
          { variableId: source.variableId, periodYear: tahunAktif, periodLabel },
          {
            variableId: source.variableId,
            periodYear: tahunAktif,
            periodLabel,
            value: result.value,
            sourceRealizationId: null,
            approvedBy: null,
            approvedAt: new Date(),
            isLocked: true,
          },
          { upsert: true, setDefaultsOnInsert: true }
        );
        pulled += 1;
        await agenda.now(RECOMPUTE_INDICATOR_VALUE_JOB, { variableId: source.variableId.toString() });
      }
    }

    if (pulled > 0) {
      console.log(`[${PULL_EXTERNAL_SOURCES_JOB}] ${pulled} nilai ditarik dari sumber eksternal.`);
    }
  });
}
