"use client";

import { useRouter } from "next/navigation";
import { unlockSchedule } from "./actions";

type ScheduleItem = {
  _id: string;
  scope: string;
  label: string;
  periodYear: number;
  periodLabel: string;
  deadlineAt: string;
  isLocked: boolean;
};

export function ScheduleTable({ schedules }: { schedules: ScheduleItem[] }) {
  const router = useRouter();

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-bg">
            {["Jenis", "Target", "Periode", "Tenggat", "Status", ""].map((h) => (
              <th key={h} className="text-left px-5 py-2.5 font-mono text-[10px] text-muted uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schedules.map((s) => (
            <tr key={s._id} className="border-t border-border">
              <td className="px-5 py-3 font-mono text-[11px] text-muted">
                {s.scope === "pelaporan_indikator" ? "Pelaporan" : "Split Tagging"}
              </td>
              <td className="px-5 py-3">{s.label}</td>
              <td className="px-5 py-3 text-muted">
                {s.periodLabel} {s.periodYear}
              </td>
              <td className="px-5 py-3 font-mono text-xs">
                {new Date(s.deadlineAt).toLocaleString("id-ID")}
              </td>
              <td className="px-5 py-3">
                <span
                  className={`font-mono text-[10.5px] font-semibold px-2.5 py-1 rounded-full ${
                    s.isLocked ? "bg-danger-tint text-danger" : "bg-success-tint text-success"
                  }`}
                >
                  {s.isLocked ? "Terkunci" : "Terbuka"}
                </span>
              </td>
              <td className="px-5 py-3">
                {s.isLocked && (
                  <button
                    onClick={async () => {
                      await unlockSchedule(s._id);
                      router.refresh();
                    }}
                    className="text-xs font-semibold text-primary"
                  >
                    Buka Kunci
                  </button>
                )}
              </td>
            </tr>
          ))}
          {schedules.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-8 text-center text-faint text-sm">
                Belum ada jadwal.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
