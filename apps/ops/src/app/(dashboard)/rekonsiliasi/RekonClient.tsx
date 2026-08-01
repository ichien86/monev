"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Link2, CheckCircle2, ShieldCheck, Info, Users } from "lucide-react";
import { reviewSubmission, overrideFinalValue, listSiblingSubmissions } from "./actions";

type QueueItem = {
  _id: string;
  indicatorId?: { _id?: string; label?: string } | null;
  workUnitId?: { name?: string } | null;
  periodLabel: string;
  periodYear: number;
  reportedValue: string;
  evidenceLink: string;
  escalatedAt?: string | null;
};

type FinalValueItem = {
  _id: string;
  indicatorId?: { label?: string } | null;
  periodLabel: string;
  periodYear: number;
  value: string;
};

type SiblingSubmission = {
  _id: string;
  workUnitId?: { name?: string } | null;
  reportedValue: string;
  status: string;
};

export function RekonClient({ queue, approved }: { queue: QueueItem[]; approved: FinalValueItem[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(queue[0]?._id ?? null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");
  const [overrideTarget, setOverrideTarget] = useState<FinalValueItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [siblings, setSiblings] = useState<SiblingSubmission[]>([]);
  const [isCrossCutting, setIsCrossCutting] = useState(false);

  const current = queue.find((q) => q._id === selectedId) ?? null;

  useEffect(() => {
    if (!current?.indicatorId?._id) {
      setSiblings([]);
      setIsCrossCutting(false);
      return;
    }
    listSiblingSubmissions(current.indicatorId._id, current.periodYear, current.periodLabel, current._id).then(
      (result) => {
        setIsCrossCutting(result.isCrossCutting);
        setSiblings(result.siblings as unknown as SiblingSubmission[]);
      }
    );
  }, [current?._id]);

  const decide = async (decision: "disetujui" | "ditolak_bapperida") => {
    if (!current) return;
    setBusy(true);
    await reviewSubmission({
      submissionId: current._id,
      decision,
      rejectionNote: decision === "ditolak_bapperida" ? rejectionNote : undefined,
    });
    setBusy(false);
    setRejecting(false);
    setRejectionNote("");
    setSelectedId(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="text-xs font-mono text-muted uppercase tracking-wide mb-3">
          Antrean Review Substansi Bapperida
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {queue.length === 0 && (
              <div className="p-5 text-sm text-faint">Antrean kosong.</div>
            )}
            {queue.map((q) => (
              <button
                key={q._id}
                onClick={() => setSelectedId(q._id)}
                className={`w-full text-left px-4 py-3.5 block border-b border-border ${selectedId === q._id ? "bg-primary-tint" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{q.indicatorId?.label ?? "—"}</span>
                  {q.escalatedAt && (
                    <span className="font-mono text-[9.5px] font-semibold text-danger bg-danger-tint px-1.5 py-0.5 rounded">
                      ESKALASI
                    </span>
                  )}
                </div>
                <div className="font-mono text-[11px] text-muted mt-1">
                  {q.workUnitId?.name ?? "—"} · {q.periodLabel} {q.periodYear}
                </div>
              </button>
            ))}
          </div>

          <div className="bg-surface border border-border rounded-xl p-6">
            {!current ? (
              <div className="text-sm text-faint">Pilih item dari antrean untuk melihat detail.</div>
            ) : (
              <>
                <div className="text-base font-semibold text-ink">{current.indicatorId?.label}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                  <div>
                    <div className="text-[10px] font-mono text-muted uppercase">PD Pengusul</div>
                    <div className="text-sm mt-1">{current.workUnitId?.name}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-muted uppercase">Periode</div>
                    <div className="text-sm mt-1">
                      {current.periodLabel} {current.periodYear}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-muted uppercase">Nilai Dilaporkan</div>
                    <div className="font-mono text-sm mt-1">{current.reportedValue}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-[10px] font-mono text-muted uppercase mb-2">
                    Bukti (Tervalidasi Sistem)
                  </div>
                  <a
                    href={current.evidenceLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success-tint text-success w-fit"
                  >
                    <Link2 size={14} />
                    <span className="font-mono text-[11.5px]">{current.evidenceLink}</span>
                    <CheckCircle2 size={14} />
                  </a>
                </div>

                {isCrossCutting && (
                  <div className="mt-4 p-3 rounded-lg bg-info-tint">
                    <div className="flex items-center gap-2 text-info">
                      <Users size={14} />
                      <span className="text-xs font-semibold">Indikator Cross-Cutting (F-05)</span>
                    </div>
                    {siblings.length === 0 ? (
                      <div className="text-[11.5px] text-[#33507A] mt-1.5">
                        Belum ada PD lain yang melapor untuk indikator &amp; periode ini.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 mt-2">
                        {siblings.map((s) => (
                          <div key={s._id} className="flex justify-between text-[11.5px] text-[#33507A]">
                            <span>{s.workUnitId?.name ?? "?"}</span>
                            <span className="font-mono">
                              {s.reportedValue} · {s.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!rejecting ? (
                  <div className="flex gap-3 mt-6">
                    <button
                      disabled={busy}
                      onClick={() => decide("disetujui")}
                      className="px-4 py-2 rounded-lg bg-success text-white text-sm font-semibold disabled:opacity-50"
                    >
                      Setujui Nilai
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setRejecting(true)}
                      className="px-4 py-2 rounded-lg bg-danger-tint text-danger text-sm font-semibold"
                    >
                      Tolak
                    </button>
                  </div>
                ) : (
                  <div className="mt-6">
                    <textarea
                      value={rejectionNote}
                      onChange={(e) => setRejectionNote(e.target.value)}
                      placeholder="Alasan penolakan…"
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm"
                    />
                    <div className="flex gap-3 mt-2">
                      <button
                        disabled={busy || rejectionNote.length === 0}
                        onClick={() => decide("ditolak_bapperida")}
                        className="px-4 py-2 rounded-lg bg-danger text-white text-sm font-semibold disabled:opacity-50"
                      >
                        Kirim Penolakan
                      </button>
                      <button onClick={() => setRejecting(false)} className="px-4 py-2 text-sm text-muted">
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={15} className="text-primary" />
          <span className="text-xs font-mono text-muted uppercase tracking-wide">
            Override Nilai Final — Single-Tier (PRD 5.3)
          </span>
        </div>
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg">
                {["Indikator", "Periode", "Final Value", ""].map((h) => (
                  <th key={h} className="text-left px-5 py-2.5 font-mono text-[10px] text-muted uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {approved.map((a) => (
                <tr key={a._id} className="border-t border-border">
                  <td className="px-5 py-3">{a.indicatorId?.label}</td>
                  <td className="px-5 py-3 text-muted">
                    {a.periodLabel} {a.periodYear}
                  </td>
                  <td className="px-5 py-3 font-mono">{a.value}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => setOverrideTarget(a)}
                      className="text-xs font-semibold text-primary"
                    >
                      Override →
                    </button>
                  </td>
                </tr>
              ))}
              {approved.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-faint text-sm">
                    Belum ada nilai final yang disetujui.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {overrideTarget && (
        <OverrideModal
          target={overrideTarget}
          onClose={() => setOverrideTarget(null)}
          onDone={() => {
            setOverrideTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function OverrideModal({
  target,
  onClose,
  onDone,
}: {
  target: FinalValueItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canSubmit = reason.length >= 500 && newValue.trim().length > 0 && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await overrideFinalValue({ finalValueId: target._id, newValue, reason });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg bg-surface rounded-xl p-6">
        <div className="text-base font-semibold text-ink">Override Nilai Final</div>
        <div className="text-xs text-muted mt-1">{target.indicatorId?.label}</div>

        <label className="flex flex-col gap-1.5 mt-4">
          <span className="text-xs font-mono text-muted uppercase">Nilai Baru</span>
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border text-sm font-mono"
          />
        </label>

        <label className="flex flex-col gap-1.5 mt-4">
          <span className="text-xs font-mono text-muted uppercase">Alasan Resmi (wajib ≥ 500 karakter)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={6}
            className="px-3 py-2 rounded-lg border border-border text-sm"
          />
          <span className={`text-xs font-mono ${reason.length >= 500 ? "text-success" : "text-faint"}`}>
            {reason.length} / 500 karakter
          </span>
        </label>

        <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-info-tint">
          <Info size={14} className="text-info mt-0.5 shrink-0" />
          <span className="text-[11.5px] text-[#33507A] leading-relaxed">
            Tindakan ini bersifat single-tier tanpa persetujuan berjenjang, dan akan tercatat
            permanen pada log audit (PRD 5.3).
          </span>
        </div>

        {error && <div className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2 mt-3">{error}</div>}

        <div className="flex gap-3 mt-5">
          <button
            disabled={!canSubmit}
            onClick={submit}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:bg-border disabled:text-faint"
          >
            {busy ? "Menyimpan…" : "Simpan Override"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted">
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
