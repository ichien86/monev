"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type IndicatorNode = {
  _id: string;
  tier: string;
  label: string;
  polarity: "positive" | "negative";
  classificationTags?: string[];
  children: IndicatorNode[];
};

const TIER_LABEL: Record<string, string> = {
  VISI: "Visi",
  MISI: "Misi",
  TUJUAN_DAERAH: "Tujuan Daerah",
  SASARAN_STRATEGIS_DAERAH: "Sasaran Strategis Daerah",
  TUJUAN_PD: "Tujuan PD",
  SASARAN_STRATEGIS_PD: "Sasaran Strategis PD",
  SASARAN_PROGRAM: "Sasaran Program",
};

function Node({
  node,
  depth,
  onSelectParent,
}: {
  node: IndicatorNode;
  depth: number;
  onSelectParent: (id: string, tier: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-start gap-2 py-2.5 group"
        style={{
          borderLeft: depth > 0 ? "2px solid #E3E6E0" : "none",
          marginLeft: depth > 0 ? 9 : 0,
          paddingLeft: depth > 0 ? 16 : 0,
        }}
      >
        <button
          onClick={() => hasChildren && setOpen((v) => !v)}
          className="mt-0.5 shrink-0"
          aria-label={open ? "Tutup" : "Buka"}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown size={15} className="text-muted" />
            ) : (
              <ChevronRight size={15} className="text-muted" />
            )
          ) : (
            <span className="inline-block w-[15px]" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] tracking-wide text-primary bg-primary-tint px-1.5 py-0.5 rounded font-semibold">
              {TIER_LABEL[node.tier] ?? node.tier}
            </span>
            {node.classificationTags?.map((tag) => (
              <span
                key={tag}
                className="font-mono text-[10px] text-accent bg-accent-tint px-1.5 py-0.5 rounded font-semibold"
              >
                {tag}
              </span>
            ))}
          </div>
          <div
            className="font-body text-ink mt-1 leading-snug"
            style={{ fontSize: depth === 0 ? 15 : 13.5, fontWeight: depth === 0 ? 600 : 500 }}
          >
            {node.label}
          </div>
          <button
            onClick={() => onSelectParent(node._id, node.tier)}
            className="text-[11px] font-mono text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-1"
          >
            + Tambah anak di bawah node ini
          </button>
        </div>
      </div>
      {hasChildren && open && (
        <div style={{ marginLeft: depth > 0 ? 25 : 14 }}>
          {node.children.map((child) => (
            <Node key={child._id} node={child} depth={depth + 1} onSelectParent={onSelectParent} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeView({
  tree,
  onSelectParent,
}: {
  tree: IndicatorNode[];
  onSelectParent: (id: string | null, tier: string | null) => void;
}) {
  if (tree.length === 0) {
    return (
      <div className="text-sm text-faint py-8 text-center">
        Belum ada data. Mulai dengan menambah node VISI.
        <div className="mt-3">
          <button
            onClick={() => onSelectParent(null, null)}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold"
          >
            Tambah Visi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {tree.map((node) => (
        <Node key={node._id} node={node} depth={0} onSelectParent={onSelectParent} />
      ))}
    </div>
  );
}
