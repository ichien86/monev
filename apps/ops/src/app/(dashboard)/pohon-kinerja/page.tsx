import { auth } from "@/auth";
import { getIndicatorTree } from "./actions";
import { PohonKinerjaClient } from "./PohonKinerjaClient";
import { getOrgUnitModel, getVariableModel } from "@simonev/db";

export default async function PohonKinerjaPage() {
  const session = await auth();
  const tree = await getIndicatorTree();
  const canEdit = session?.user.role === "bapperida" || session?.user.role === "admin_sistem";

  const OrgUnitModel = await getOrgUnitModel();
  const orgUnits = await OrgUnitModel.find({ isActive: true }).select("name").sort({ name: 1 }).lean();

  const VariableModel = await getVariableModel();
  const variables = await VariableModel.find({ isActive: true })
    .select("name unit")
    .sort({ name: 1 })
    .lean();

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-ink">Pohon Kinerja</h1>
        <p className="text-sm text-muted mt-1">
          Hierarki Visi → Misi → Tujuan Daerah → Sasaran Strategis Daerah → Tujuan PD →
          Sasaran Strategis PD → Sasaran Program (F-01, PRD 5.1).
        </p>
      </div>
      {/* JSON round-trip: mengubah ObjectId/Date hasil .lean() jadi tipe
          serializable (string) sebelum dikirim ke Client Component — Next.js
          mewajibkan props Server→Client berupa data polos, bukan instance kelas. */}
      <PohonKinerjaClient
        tree={JSON.parse(JSON.stringify(tree))}
        canEdit={canEdit}
        orgUnits={JSON.parse(JSON.stringify(orgUnits))}
        variables={JSON.parse(JSON.stringify(variables))}
      />
    </div>
  );
}
