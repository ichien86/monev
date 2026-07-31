import { listPendingReview, listApprovedFinalValues } from "./actions";
import { RekonClient } from "./RekonClient";

export default async function RekonsiliasiPage() {
  const [queue, approved] = await Promise.all([listPendingReview(), listApprovedFinalValues()]);

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-ink">Rekonsiliasi & Approval</h1>
        <p className="text-sm text-muted mt-1">
          Review substansi bukti dan penetapan nilai final (F-08). Tidak ada ranking sumber
          otomatis — semua submission diperlakukan setara (PRD 5.3).
        </p>
      </div>
      <RekonClient
        queue={JSON.parse(JSON.stringify(queue))}
        approved={JSON.parse(JSON.stringify(approved))}
      />
    </div>
  );
}
