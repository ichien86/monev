import { listSimulatableIndicators } from "./actions";
import { SimulationClient } from "./SimulationClient";

export default async function SimulasiPage() {
  const indicators = await listSimulatableIndicators();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-ink">Simulasi &amp; What-If Analysis</h1>
        <p className="text-sm text-muted mt-1">
          Coba nilai realisasi hipotetis dan lihat dampaknya terhadap capaian% tanpa mengubah data
          sungguhan (F-07).
        </p>
      </div>
      <SimulationClient indicators={JSON.parse(JSON.stringify(indicators))} />
    </div>
  );
}
