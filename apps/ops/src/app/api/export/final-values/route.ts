import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { getFinalValueModel } from "@simonev/db";

/**
 * F-11 — Ekspor CSV (DDT Section 4.B: "Route Handler streaming CSV/XLSX").
 * CSV dipilih dibanding XLSX untuk versi pertama ini — bisa dibuka semua
 * software spreadsheet tanpa dependency parsing tambahan di sisi klien;
 * upgrade ke XLSX (pakai ExcelJS, sudah jadi dependency untuk F-02) tinggal
 * mengganti bagian pembuatan response di bawah kalau dibutuhkan nanti.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const periodYear = searchParams.get("periodYear");
  const workUnitIdParam = searchParams.get("workUnitId");

  const query: Record<string, unknown> = {};
  if (periodYear) query.periodYear = Number(periodYear);

  // Sama seperti actions.ts: PD/OPD dipaksa hanya bisa ekspor data OPD-nya
  // sendiri, ditegakkan di server — parameter workUnitId dari luar diabaikan
  // untuk role pd_opd, BUKAN hanya disembunyikan di UI.
  if (session.user.role === "pd_opd") {
    query.workUnitId = session.user.workUnitId;
  } else if (workUnitIdParam) {
    query.workUnitId = workUnitIdParam;
  }

  const FinalValueModel = await getFinalValueModel();
  const rows = await FinalValueModel.find(query)
    .sort({ approvedAt: -1 })
    .limit(2000)
    .populate("indicatorId", "label unit")
    .populate("workUnitId", "name")
    .populate("approvedBy", "name")
    .lean();

  const header = ["Indikator", "Satuan", "OPD", "Periode", "Nilai Final", "Disetujui Oleh", "Tanggal Approve"];
  // RFC 4180: bungkus dengan tanda kutip kalau mengandung koma/kutip/baris baru,
  // dan gandakan setiap tanda kutip di dalamnya -- kalau tidak, field yang
  // memuat tanda kutip (mis. nama program berformat "...") merusak kolom
  // di seluruh baris saat dibuka di Excel/Google Sheets.
  function escapeCsvCell(value: string): string {
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }
  const csvLines = [header.join(",")];

  for (const r of rows) {
    const indicator = r.indicatorId as unknown as { label?: string; unit?: string } | null;
    const workUnit = r.workUnitId as unknown as { name?: string } | null;
    const approver = r.approvedBy as unknown as { name?: string } | null;
    const cells = [
      indicator?.label ?? "",
      indicator?.unit ?? "",
      workUnit?.name ?? "",
      `${r.periodLabel} ${r.periodYear}`,
      r.value,
      approver?.name ?? "",
      new Date(r.approvedAt).toISOString(),
    ];
    csvLines.push(cells.map((c) => escapeCsvCell(String(c))).join(","));
  }

  const csv = csvLines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="simonev-laporan-${Date.now()}.csv"`,
    },
  });
}
