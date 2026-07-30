"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";
import { ThemeManager } from "./ThemeManager";
import { BudgetTree } from "./BudgetTree";
import { CreateTaggingModal } from "./CreateTaggingModal";
import { SplitEntryModal } from "./SplitEntryModal";
import { ExcelImportButton } from "./ExcelImportButton";
import { seedExampleBudgetStructure, copyTaggingsFromPreviousYear } from "./actions";

type Theme = { _id: string; name: string; colorHex: string };
type EffectiveTag = {
  taggingId: string;
  themeId: string;
  themeName: string;
  colorHex: string;
  coverage: "penuh" | "sebagian";
  coveragePercent: number | null;
  inheritedFromName: string | null;
};
type BudgetNode = {
  _id: string;
  level: string;
  name: string;
  pagu: number;
  ownerWorkUnitId: string | null;
  children: BudgetNode[];
  tags?: EffectiveTag[];
};

function filterTreeByTema(nodes: BudgetNode[], active: Set<string>): BudgetNode[] {
  return nodes.map((n) => ({
    ...n,
    tags: n.tags?.filter((t) => active.has(t.themeId)),
    children: filterTreeByTema(n.children, active),
  }));
}

export function TaggingClient({
  themes,
  tree,
  budgetYear,
  myWorkUnitId,
  canManage,
}: {
  themes: Theme[];
  tree: BudgetNode[];
  budgetYear: number;
  myWorkUnitId: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [activeTema, setActiveTema] = useState<Set<string>>(new Set(themes.map((t) => t._id)));
  const [tagTarget, setTagTarget] = useState<BudgetNode | null>(null);
  const [splitTarget, setSplitTarget] = useState<EffectiveTag | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const toggleTema = (id: string) =>
    setActiveTema((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filteredTree = useMemo(() => filterTreeByTema(tree, activeTema), [tree, activeTema]);

  const runSeed = async () => {
    setBusy(true);
    setNotice(null);
    const result = await seedExampleBudgetStructure(budgetYear);
    setBusy(false);
    setNotice(result.ok ? `Berhasil mengisi ${result.data.imported} baris data contoh.` : result.error);
    router.refresh();
  };

  const runCopyAdvice = async () => {
    setBusy(true);
    setNotice(null);
    const result = await copyTaggingsFromPreviousYear(budgetYear - 1, budgetYear);
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error);
    } else {
      const { copied, unmatched } = result.data;
      setNotice(
        `${copied} tagging disalin dari ${budgetYear - 1}.` +
          (unmatched.length > 0
            ? ` ${unmatched.length} item tidak bisa disalin (struktur berubah): ${unmatched.join(", ")}.`
            : "")
      );
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ThemeManager themes={themes} activeTema={activeTema} toggleTema={toggleTema} canManage={canManage} />
        {canManage && (
          <div className="flex gap-2">
            <ExcelImportButton budgetYear={budgetYear} />
            <button
              disabled={busy}
              onClick={runSeed}
              className="text-xs font-semibold text-primary border border-border rounded-lg px-3 py-1.5"
            >
              Isi Data Contoh (RPJMD {budgetYear})
            </button>
            <button
              disabled={busy}
              onClick={runCopyAdvice}
              className="flex items-center gap-1 text-xs font-semibold text-primary border border-border rounded-lg px-3 py-1.5"
            >
              <RefreshCw size={11} /> Salin Tagging dari {budgetYear - 1}
            </button>
          </div>
        )}
      </div>

      {notice && (
        <div className="text-[12.5px] text-primary-deep bg-primary-tint rounded-lg px-3 py-2">{notice}</div>
      )}

      <div className="bg-surface border border-border rounded-xl px-5 py-2">
        <BudgetTree
          tree={filteredTree}
          myWorkUnitId={myWorkUnitId}
          onTagNode={(node) => canManage && setTagTarget(node)}
          onEnterSplit={(tag) => setSplitTarget(tag)}
        />
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary-tint">
        <Info size={16} className="text-primary mt-0.5 shrink-0" />
        <div className="text-[12.5px] text-primary-deep leading-relaxed">
          Prasyarat: struktur anggaran (Program/Kegiatan/Subkegiatan) harus diimpor dari SIPD
          sebelum tagging dimulai (PRD 5.6). Klik ikon tag pada baris untuk menandai node dengan
          tema.
        </div>
      </div>
      <div className="flex items-start gap-3 p-4 rounded-xl bg-accent-tint">
        <AlertTriangle size={16} className="text-accent mt-0.5 shrink-0" />
        <div className="text-[12.5px] text-[#7A5A1C] leading-relaxed">
          Overlap antar tema diperbolehkan dan merepresentasikan &quot;kinerja berbagi pakai&quot; —
          bukan kesalahan data.
        </div>
      </div>

      {tagTarget && (
        <CreateTaggingModal
          node={tagTarget}
          themes={themes}
          budgetYear={budgetYear}
          onClose={() => setTagTarget(null)}
          onDone={() => {
            setTagTarget(null);
            router.refresh();
          }}
        />
      )}

      {splitTarget && (
        <SplitEntryModal
          taggingId={splitTarget.taggingId}
          themeName={splitTarget.themeName}
          currentPercent={splitTarget.coveragePercent}
          onClose={() => setSplitTarget(null)}
          onDone={() => {
            setSplitTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
