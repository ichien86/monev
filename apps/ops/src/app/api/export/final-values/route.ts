import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { listFinalValuesForReport } from "@/app/(dashboard)/laporan/actions";

/**
 * F-11 — Ekspor CSV (DDT Section 4.B: "Route Handler streaming CSV/XLSX").
 * DDT v2.0 — memakai sumber data yang sama dengan halaman laporan
 * (`listFinalValuesForReport`, dihitung dari formula variabel) supaya kedua
 * tampilan tidak pernah berbeda. CSV dipilih dibanding XLSX untuk versi
 * pertama ini — bisa dibuka semua software spreadsheet tanpa dependency
 * parsing tambahan di sisi klien.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const periodYear = searchParams.get("periodYear");
  const workUnitIdParam = searchParams.get("workUnitId");

  const rows = await listFinalValuesForReport({
    periodYear: periodYear ? Number(periodYear) : undefined,
    workUnitId: workUnitIdParam ?? undefined,
  });

  const header = ["Indikator", "Satuan", "OPD", "Tahun", "Nilai", "Status", "Update Terakhir"];
  const csvLines = [header.join(",")];

  for (const r of rows) {
    const cells = [
      r.indicatorLabel,
      r.unit ?? "",
      r.workUnitName ?? "",
      String(r.periodYear),
      r.value ?? "",
      r.status,
      r.approvedAt ? new Date(r.approvedAt).toISOString() : "",
    ];
    // Escape sederhana: bungkus dengan tanda kutip kalau mengandung koma.
    csvLines.push(cells.map((c) => (String(c).includes(",") ? `"${c}"` : c)).join(","));
  }

  const csv = csvLines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="simonev-laporan-${Date.now()}.csv"`,
    },
  });
}
