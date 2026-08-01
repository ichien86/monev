"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { TreeView } from "./TreeView";
import { IndicatorForm } from "./IndicatorForm";

type IndicatorNode = {
  _id: string;
  tier: string;
  label: string;
  polarity: "positive" | "negative";
  classificationTags?: string[];
  children: IndicatorNode[];
};
type OrgUnitOption = { _id: string; name: string };
type VariableOption = { _id: string; name: string; unit: string | null };

export function PohonKinerjaClient({
  tree,
  canEdit,
  orgUnits,
  variables,
}: {
  tree: IndicatorNode[];
  canEdit: boolean;
  orgUnits: OrgUnitOption[];
  variables: VariableOption[];
}) {
  const router = useRouter();
  const [formTarget, setFormTarget] = useState<{ id: string | null; tier: string | null } | null>(
    null
  );

  return (
    <div>
      {canEdit && (
        <button
          onClick={() => setFormTarget({ id: null, tier: null })}
          className="mb-4 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-semibold text-primary"
        >
          <Plus size={14} /> Tambah Visi Baru
        </button>
      )}

      <div className="bg-surface border border-border rounded-xl px-5 py-2">
        <TreeView
          tree={tree}
          onSelectParent={(id, tier) => canEdit && setFormTarget({ id, tier })}
        />
      </div>

      {formTarget && (
        <IndicatorForm
          parentId={formTarget.id}
          parentTier={formTarget.tier}
          orgUnits={orgUnits}
          variables={variables}
          onClose={() => setFormTarget(null)}
          onCreated={() => {
            setFormTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
