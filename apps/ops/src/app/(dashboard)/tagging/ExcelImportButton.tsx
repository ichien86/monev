"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { importBudgetStructureFromExcel } from "./actions";

export function ExcelImportButton({ budgetYear }: { budgetYear: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setNotice(null);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("budgetYear", String(budgetYear));

    const result = await importBudgetStructureFromExcel(formData);
    setBusy(false);
    setNotice(result.ok ? `Berhasil mengimpor ${result.data.imported} baris dari Excel.` : result.error);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1 text-xs font-semibold text-primary border border-border rounded-lg px-3 py-1.5"
      >
        <Upload size={11} /> {busy ? "Mengimpor…" : "Impor Excel SIPD"}
      </button>
      <input ref={inputRef} type="file" accept=".xlsx" onChange={onFileChange} className="hidden" />
      {notice && <span className="text-[11px] text-muted">{notice}</span>}
    </div>
  );
}
