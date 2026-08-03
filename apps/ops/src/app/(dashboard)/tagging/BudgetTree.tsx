"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Tag } from "lucide-react";

type EffectiveTag = {
  taggingId: string;
  themeId: string;
  themeName: string;
  colorHex: string;
  coverage: "penuh" | "sebagian";
  amountRupiah: number | null;
  inheritedFromName: string | null;
};

type BudgetNode = {
  _id: string;
  level: string;
  name: string;
  pagu: number;
  realisasi: number;
  ownerWorkUnitId: string | null;
  children: BudgetNode[];
  tags?: EffectiveTag[];
};

function rp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

const LEVEL_LABEL: Record<string, string> = {
  program: "Program",
  kegiatan: "Kegiatan",
  subkegiatan: "Subkegiatan",
  rekening: "Rekening",
};

function Node({
  node,
  depth,
  myWorkUnitId,
  onTagNode,
  onEditAllocation,
}: {
  node: BudgetNode;
  depth: number;
  myWorkUnitId: string | null;
  onTagNode: (node: BudgetNode) => void;
  onEditAllocation: (node: BudgetNode, tag: EffectiveTag) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const isLeaf = !hasChildren;
  const isMine = Boolean(isLeaf && myWorkUnitId && node.ownerWorkUnitId === myWorkUnitId);
  // DDT v2.0 Section 2.7 — Tagging SELALU dibuat di level subkegiatan.
  const canTag = node.level === "subkegiatan";

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2.5 group"
        style={{
          borderLeft: depth > 0 ? "2px solid #E3E6E0" : "none",
          marginLeft: depth > 0 ? 9 : 0,
          paddingLeft: depth > 0 ? 16 : 0,
        }}
      >
        <button onClick={() => hasChildren && setOpen((v) => !v)} className="shrink-0" aria-label="Toggle">
          {hasChildren ? (
            open ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />
          ) : (
            <span className="inline-block w-[14px]" />
          )}
        </button>
        <span className="font-mono text-[9.5px] text-faint uppercase tracking-wide w-[78px] shrink-0">
          {LEVEL_LABEL[node.level]}
        </span>
        <span
          className="text-ink flex-1"
          style={{ fontSize: depth === 0 ? 13.5 : 13, fontWeight: depth === 0 ? 600 : 500 }}
        >
          {node.name}
        </span>
        <span className="font-mono text-xs text-muted shrink-0">
          {rp(node.pagu)}
          {node.level === "rekening" && <span className="text-faint"> · realisasi {rp(node.realisasi)}</span>}
        </span>
        {canTag && (
          <button
            onClick={() => onTagNode(node)}
            className="shrink-0 text-primary opacity-0 group-hover:opacity-100"
            title="Tag node ini"
          >
            <Tag size={13} />
          </button>
        )}
      </div>

      {isLeaf && node.tags && node.tags.length > 0 && (
        <div className="ml-9 mb-3 flex flex-col gap-1.5">
          {node.tags.map((t) => (
            <div key={t.taggingId} className="flex flex-wrap items-center gap-2 text-[11.5px]">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: t.colorHex }} />
              <span className="font-semibold text-ink">{t.themeName}</span>
              <span className="font-mono text-muted">
                {t.coverage === "penuh" ? "Cakupan: Seluruh anggaran" : `Cakupan: ${rp(t.amountRupiah ?? 0)}`}
              </span>
              {t.inheritedFromName && (
                <span className="font-mono text-faint">· diwariskan dari {t.inheritedFromName}</span>
              )}
              {isMine && t.coverage === "sebagian" && (
                <button onClick={() => onEditAllocation(node, t)} className="text-primary font-semibold">
                  Ubah Alokasi
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {hasChildren && open && (
        <div style={{ marginLeft: depth > 0 ? 23 : 14 }}>
          {node.children.map((child) => (
            <Node
              key={child._id}
              node={child}
              depth={depth + 1}
              myWorkUnitId={myWorkUnitId}
              onTagNode={onTagNode}
              onEditAllocation={onEditAllocation}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BudgetTree({
  tree,
  myWorkUnitId,
  onTagNode,
  onEditAllocation,
}: {
  tree: BudgetNode[];
  myWorkUnitId: string | null;
  onTagNode: (node: BudgetNode) => void;
  onEditAllocation: (node: BudgetNode, tag: EffectiveTag) => void;
}) {
  if (tree.length === 0) {
    return <div className="text-sm text-faint py-8 text-center">Belum ada struktur anggaran untuk tahun ini.</div>;
  }
  return (
    <div>
      {tree.map((node) => (
        <Node
          key={node._id}
          node={node}
          depth={0}
          myWorkUnitId={myWorkUnitId}
          onTagNode={onTagNode}
          onEditAllocation={onEditAllocation}
        />
      ))}
    </div>
  );
}
