import { auth } from "@/auth";
import { listVariables } from "./actions";
import { VariableManager } from "./VariableManager";

export default async function VariabelPage() {
  const session = await auth();
  const variables = await listVariables();
  const canManage = session?.user.role === "bapperida" || session?.user.role === "admin_sistem";

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-ink">Master Variabel</h1>
        <p className="text-sm text-muted mt-1">
          Katalog variabel statistik/sumber data (BPS, SIPD, dst.) yang dapat dirujuk indikator
          dengan metode perhitungan Weighted Sum (F-01, PRD 5.1).
        </p>
      </div>
      <VariableManager initialVariables={JSON.parse(JSON.stringify(variables))} canManage={canManage} />
    </div>
  );
}
