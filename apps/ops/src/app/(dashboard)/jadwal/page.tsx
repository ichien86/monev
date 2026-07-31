import { listSchedules, listSasaranProgramIndicators, listTaggingsRequiringSchedule } from "./actions";
import { ScheduleForm } from "./ScheduleForm";
import { ScheduleTable } from "./ScheduleTable";

export default async function JadwalPage() {
  const [schedules, indicators, taggings] = await Promise.all([
    listSchedules(),
    listSasaranProgramIndicators(),
    listTaggingsRequiringSchedule(),
  ]);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-ink">Penjadwalan &amp; Penguncian</h1>
        <p className="text-sm text-muted mt-1">
          Jadwal tenggat pelaporan indikator (F-04) dan entri split tagging tematik (F-02) — job
          otomatis mengunci periode yang lewat tenggat setiap jam (F-03).
        </p>
      </div>

      <ScheduleForm
        indicatorOptions={indicators.map((i) => ({ _id: i._id.toString(), label: i.label }))}
        taggingOptions={taggings}
      />

      <ScheduleTable schedules={JSON.parse(JSON.stringify(schedules))} />
    </div>
  );
}
