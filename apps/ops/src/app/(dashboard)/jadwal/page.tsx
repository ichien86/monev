import { listSchedules, listSasaranProgramIndicators } from "./actions";
import { ScheduleForm } from "./ScheduleForm";
import { ScheduleTable } from "./ScheduleTable";

export default async function JadwalPage() {
  const [schedules, indicators] = await Promise.all([listSchedules(), listSasaranProgramIndicators()]);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-ink">Penjadwalan &amp; Penguncian</h1>
        <p className="text-sm text-muted mt-1">
          Jadwal tenggat pelaporan indikator, penentuan target, dan penutupan tahun (F-03, DDT v2.0
          Section 2.12) — job otomatis mengunci periode yang lewat tenggat setiap jam.
        </p>
      </div>

      <ScheduleForm indicatorOptions={indicators.map((i) => ({ _id: i._id.toString(), label: i.label }))} />

      <ScheduleTable schedules={JSON.parse(JSON.stringify(schedules))} />
    </div>
  );
}
