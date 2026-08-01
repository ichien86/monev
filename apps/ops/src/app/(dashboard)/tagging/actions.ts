"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  getThemeModel,
  getBudgetStructureModel,
  getTaggingModel,
  getOrgUnitModel,
  getScheduleModel,
  getSipdNomenclatureChangeModel,
} from "@simonev/db";
import {
  createThemeSchema,
  importBudgetStructureSchema,
  createTaggingSchema,
  enterSplitCoverageSchema,
  type CreateThemeInput,
  type ImportBudgetStructureInput,
  type CreateTaggingInput,
  type EnterSplitCoverageInput,
} from "@simonev/schemas";
import type { ActionResult } from "@/lib/action-result";
import { agenda } from "@/worker/agenda";
import { SYNC_READMODEL_JOB } from "@/worker/jobs/syncReadmodel.job";

function requireTaggingManager(role: string | undefined) {
  return role === "bapperida" || role === "admin_sistem";
}

/* --------------------------------- Tema --------------------------------- */

export async function createTheme(input: CreateThemeInput): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!requireTaggingManager(session?.user.role)) {
    return { ok: false, error: "Hanya Bapperida/Admin Sistem yang dapat membuat tema." };
  }
  const parsed = createThemeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };

  const ThemeModel = await getThemeModel();
  const existing = await ThemeModel.findOne({ name: parsed.data.name }).lean();
  if (existing) return { ok: false, error: "Nama tema sudah dipakai." };

  const created = await ThemeModel.create({ ...parsed.data, createdBy: session!.user.id });
  revalidatePath("/tagging");
  return { ok: true, data: { id: created._id.toString() } };
}

export async function listThemes() {
  const ThemeModel = await getThemeModel();
  return ThemeModel.find({ isActive: true }).sort({ name: 1 }).lean();
}

/* ---------------------------- Impor Struktur SIPD ------------------------- */

/**
 * F-02 prasyarat (PRD 5.6): "harus dilakukan import data dari SIPD mengenai
 * anggaran sampai dengan rekening belanja sebelum proses tagging". Dibangun
 * multi-pass per level (program → kegiatan → subkegiatan) karena
 * BudgetStructure butuh `parentId` (ObjectId), sedangkan baris impor hanya
 * berisi `parentSipdCode` (string) — resolusi kode→ObjectId hanya bisa
 * dilakukan setelah level induknya benar-benar tersimpan.
 */
export async function importBudgetStructure(
  input: ImportBudgetStructureInput
): Promise<ActionResult<{ imported: number }>> {
  const session = await auth();
  if (!requireTaggingManager(session?.user.role)) {
    return { ok: false, error: "Hanya Bapperida/Admin Sistem yang dapat mengimpor struktur anggaran." };
  }
  const parsed = importBudgetStructureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const { budgetYear, rows } = parsed.data;

  const BudgetStructureModel = await getBudgetStructureModel();
  const OrgUnitModel = await getOrgUnitModel();
  const SipdNomenclatureChangeModel = await getSipdNomenclatureChangeModel();

  const orgUnitsBySipd = new Map(
    (await OrgUnitModel.find({}).lean()).map((u) => [u.sipdCode, u._id])
  );

  // F-09: siapkan lookup struktur tahun SEBELUMNYA untuk deteksi perubahan
  // nomenklatur (nama/level/kode induk berubah untuk kode SIPD yang sama).
  const previousYearStructures = await BudgetStructureModel.find({ budgetYear: budgetYear - 1 }).lean();
  const previousById = new Map(previousYearStructures.map((s) => [s._id.toString(), s]));
  const previousBySipd = new Map(previousYearStructures.map((s) => [s.sipdCode, s]));

  let imported = 0;
  for (const level of ["program", "kegiatan", "subkegiatan"] as const) {
    const levelRows = rows.filter((r) => r.level === level);
    for (const row of levelRows) {
      let parentId = null;
      if (row.parentSipdCode) {
        const parent = await BudgetStructureModel.findOne({
          sipdCode: row.parentSipdCode,
          budgetYear,
        }).lean();
        if (!parent) {
          return {
            ok: false,
            error: `Baris "${row.name}" (${row.sipdCode}) mereferensikan induk ${row.parentSipdCode} yang belum/tidak ada di data impor.`,
          };
        }
        parentId = parent._id;
      }

      // F-09 — bandingkan dengan tahun sebelumnya, kode SIPD yang sama.
      const previous = previousBySipd.get(row.sipdCode);
      if (previous) {
        const previousParentSipdCode = previous.parentId
          ? previousById.get(previous.parentId.toString())?.sipdCode ?? null
          : null;
        const changes: { field: "name" | "level" | "parentSipdCode"; oldValue: string; newValue: string }[] = [];
        if (previous.name !== row.name) changes.push({ field: "name", oldValue: previous.name, newValue: row.name });
        if (previous.level !== row.level) changes.push({ field: "level", oldValue: previous.level, newValue: row.level });
        if ((previousParentSipdCode ?? "") !== (row.parentSipdCode ?? "")) {
          changes.push({
            field: "parentSipdCode",
            oldValue: previousParentSipdCode ?? "(tidak ada induk)",
            newValue: row.parentSipdCode ?? "(tidak ada induk)",
          });
        }
        if (changes.length > 0) {
          await SipdNomenclatureChangeModel.insertMany(
            changes.map((c) => ({
              sipdCode: row.sipdCode,
              fromYear: budgetYear - 1,
              toYear: budgetYear,
              fieldChanged: c.field,
              oldValue: c.oldValue,
              newValue: c.newValue,
              detectedAt: new Date(),
            }))
          );
        }
      }

      await BudgetStructureModel.findOneAndUpdate(
        { sipdCode: row.sipdCode, budgetYear },
        {
          level: row.level,
          sipdCode: row.sipdCode,
          parentId,
          name: row.name,
          budgetYear,
          pagu: row.pagu,
          ownerWorkUnitId: row.ownerWorkUnitSipdCode
            ? orgUnitsBySipd.get(row.ownerWorkUnitSipdCode) ?? null
            : null,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      imported += 1;
    }
  }

  await agenda.now(SYNC_READMODEL_JOB, {});
  revalidatePath("/tagging");
  return { ok: true, data: { imported } };
}

/**
 * Impor SIPD dari file Excel sungguhan (.xlsx) — pelengkap `importBudgetStructure`
 * di atas (yang menerima baris terstruktur/JSON). Format kolom yang diharapkan
 * pada baris header (case-insensitive): Level | Kode SIPD | Kode Induk | Nama |
 * Pagu | Kode SIPD OPD. Baris pertama SELALU dianggap header dan dilewati.
 */
export async function importBudgetStructureFromExcel(formData: FormData): Promise<ActionResult<{ imported: number }>> {
  const session = await auth();
  if (!requireTaggingManager(session?.user.role)) {
    return { ok: false, error: "Hanya Bapperida/Admin Sistem yang dapat mengimpor struktur anggaran." };
  }

  const file = formData.get("file");
  const budgetYearRaw = formData.get("budgetYear");
  if (!(file instanceof File) || typeof budgetYearRaw !== "string") {
    return { ok: false, error: "File dan tahun anggaran wajib diisi." };
  }
  const budgetYear = Number(budgetYearRaw);

  const workbook = new ExcelJS.Workbook();
  try {
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);
  } catch {
    return { ok: false, error: "File tidak dapat dibaca — pastikan format .xlsx yang valid." };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return { ok: false, error: "File Excel tidak berisi sheet apa pun." };

  const rows: {
    level: "program" | "kegiatan" | "subkegiatan";
    sipdCode: string;
    parentSipdCode: string | null;
    name: string;
    pagu: number;
    ownerWorkUnitSipdCode: string | null;
  }[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // lewati header
    const [, levelRaw, sipdCode, parentSipdCode, name, paguRaw, ownerSipdCode] = row.values as unknown[];
    if (!sipdCode || !name) return; // baris kosong/pemisah, lewati

    const level = String(levelRaw ?? "").trim().toLowerCase();
    if (level !== "program" && level !== "kegiatan" && level !== "subkegiatan") return;

    rows.push({
      level,
      sipdCode: String(sipdCode).trim(),
      parentSipdCode: parentSipdCode ? String(parentSipdCode).trim() : null,
      name: String(name).trim(),
      pagu: Number(paguRaw) || 0,
      ownerWorkUnitSipdCode: ownerSipdCode ? String(ownerSipdCode).trim() : null,
    });
  });

  if (rows.length === 0) {
    return { ok: false, error: "Tidak ada baris data valid ditemukan di file (cek format kolom)." };
  }

  return importBudgetStructure({ budgetYear, rows });
}

export async function createTagging(input: CreateTaggingInput): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!requireTaggingManager(session?.user.role)) {
    return { ok: false, error: "Hanya Bapperida/Admin Sistem yang dapat membuat tagging." };
  }
  const parsed = createTaggingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };

  const TaggingModel = await getTaggingModel();
  const existing = await TaggingModel.findOne({
    themeId: parsed.data.themeId,
    budgetStructureId: parsed.data.budgetStructureId,
    budgetYear: parsed.data.budgetYear,
  }).lean();
  if (existing) return { ok: false, error: "Node ini sudah ditandai dengan tema tersebut." };

  const created = await TaggingModel.create({
    ...parsed.data,
    coveragePercent: null, // selalu null di awal — diisi PD saat realisasi (PRD 5.6)
    createdBy: session!.user.id,
  });
  await agenda.now(SYNC_READMODEL_JOB, {});
  revalidatePath("/tagging");
  return { ok: true, data: { id: created._id.toString() } };
}

/**
 * F-02 (PRD 5.6): "yang entri Perangkat Daerah (PD)... per tagging dipisahkan
 * prosesnya". PD hanya boleh mengisi split untuk subkegiatan milik OPD-nya
 * sendiri — dicek lewat BudgetStructure.ownerWorkUnitId.
 */
export async function enterSplitCoverage(input: EnterSplitCoverageInput): Promise<ActionResult> {
  const session = await auth();
  if (session?.user.role !== "pd_opd" || !session.user.workUnitId) {
    return { ok: false, error: "Hanya operator PD/OPD yang dapat mengentri split cakupan." };
  }
  const parsed = enterSplitCoverageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };

  const TaggingModel = await getTaggingModel();
  const BudgetStructureModel = await getBudgetStructureModel();

  const tagging = await TaggingModel.findById(parsed.data.taggingId);
  if (!tagging || tagging.coverage !== "sebagian") {
    return { ok: false, error: "Tagging tidak ditemukan atau bukan bercakupan sebagian." };
  }

  const structure = await BudgetStructureModel.findById(tagging.budgetStructureId).lean();
  if (!structure || String(structure.ownerWorkUnitId) !== session.user.workUnitId) {
    return { ok: false, error: "Anda tidak berwenang mengentri split untuk struktur anggaran ini." };
  }

  const ScheduleModel = await getScheduleModel();
  const lockedSchedule = await ScheduleModel.findOne({
    scope: "entri_split_tagging",
    refId: tagging._id,
    isLocked: true,
  }).lean();
  if (lockedSchedule) {
    return {
      ok: false,
      error: "Jadwal entri split untuk tagging ini sudah terkunci (F-03) dan tidak dapat diubah.",
    };
  }

  tagging.coveragePercent = parsed.data.coveragePercent;
  tagging.splitEnteredBy = session.user.id as any;
  tagging.splitEnteredAt = new Date();
  await tagging.save();

  await agenda.now(SYNC_READMODEL_JOB, {});
  revalidatePath("/tagging");
  return { ok: true, data: undefined };
}

/**
 * Data contoh — BUKAN pengganti impor SIPD sungguhan. Memakai baris program
 * riil dari Tabel IV.1 RPJMD Kabupaten Boyolali 2025–2029 (pagu indikatif
 * 2026) supaya modul ini langsung punya isi yang bermakna untuk demo/dev,
 * konsisten dengan seed script F-01. Untuk produksi, gunakan
 * `importBudgetStructure` dengan hasil parsing Excel SIPD sungguhan.
 */
export async function seedExampleBudgetStructure(budgetYear: number): Promise<ActionResult<{ imported: number }>> {
  const OrgUnitModel = await getOrgUnitModel();
  const dinkes = await OrgUnitModel.findOne({ name: "Dinas Kesehatan" }).lean();
  const dkp = await OrgUnitModel.findOne({ name: "Dinas Ketahanan Pangan" }).lean();
  const dinsos = await OrgUnitModel.findOne({ name: "Dinas Sosial" }).lean();

  return importBudgetStructure({
    budgetYear,
    rows: [
      {
        level: "program",
        sipdCode: "1.02.02",
        parentSipdCode: null,
        name: "Program Pemenuhan Upaya Kesehatan Perorangan dan Upaya Kesehatan Masyarakat",
        pagu: 145098623382,
        ownerWorkUnitSipdCode: dinkes?.sipdCode ?? null,
      },
      {
        level: "program",
        sipdCode: "1.06.05",
        parentSipdCode: null,
        name: "Program Perlindungan dan Jaminan Sosial",
        pagu: 5803250000,
        ownerWorkUnitSipdCode: dinsos?.sipdCode ?? null,
      },
      {
        level: "program",
        sipdCode: "2.09.03",
        parentSipdCode: null,
        name: "Program Peningkatan Diversifikasi dan Ketahanan Pangan Masyarakat",
        pagu: 1104672000,
        ownerWorkUnitSipdCode: dkp?.sipdCode ?? null,
      },
      {
        level: "program",
        sipdCode: "2.09.05",
        parentSipdCode: null,
        name: "Program Pengawasan Keamanan Pangan",
        pagu: 111000000,
        ownerWorkUnitSipdCode: dkp?.sipdCode ?? null,
      },
    ],
  });
}

/**
 * F-02 — copy-advice antar tahun (PRD 5.6): mencocokkan struktur tahun
 * sebelumnya dengan tahun berjalan BERBASIS KODE SIPD (bukan kemiripan nama).
 * Item dengan kode yang cocok DAN punya anggaran di tahun berjalan → auto-copy
 * tagging-nya. Item yang kodenya tidak ditemukan di tahun berjalan → tidak
 * disalin, harus ditag manual (dikembalikan di `unmatched` untuk ditampilkan
 * sebagai peringatan di UI).
 */
export async function copyTaggingsFromPreviousYear(
  fromYear: number,
  toYear: number
): Promise<ActionResult<{ copied: number; unmatched: string[] }>> {
  const session = await auth();
  if (!requireTaggingManager(session?.user.role)) {
    return { ok: false, error: "Hanya Bapperida/Admin Sistem yang dapat menyalin tagging." };
  }

  const BudgetStructureModel = await getBudgetStructureModel();
  const TaggingModel = await getTaggingModel();

  const [prevStructures, currStructures, prevTaggings] = await Promise.all([
    BudgetStructureModel.find({ budgetYear: fromYear }).lean(),
    BudgetStructureModel.find({ budgetYear: toYear }).lean(),
    TaggingModel.find({ budgetYear: fromYear }).lean(),
  ]);

  const currBySipd = new Map(currStructures.map((s) => [s.sipdCode, s]));
  const prevById = new Map(prevStructures.map((s) => [s._id.toString(), s]));

  let copied = 0;
  const unmatched: string[] = [];

  for (const tag of prevTaggings) {
    const prevStructure = prevById.get(tag.budgetStructureId.toString());
    if (!prevStructure) continue;

    const currStructure = currBySipd.get(prevStructure.sipdCode);
    if (!currStructure) {
      unmatched.push(`${prevStructure.name} (${prevStructure.sipdCode})`);
      continue;
    }

    await TaggingModel.findOneAndUpdate(
      { themeId: tag.themeId, budgetStructureId: currStructure._id, budgetYear: toYear },
      {
        themeId: tag.themeId,
        budgetStructureId: currStructure._id,
        budgetYear: toYear,
        coverage: tag.coverage,
        coveragePercent: null, // split TIDAK ikut disalin — wajib dientri ulang PD di tahun baru
        requiresSubTagging: tag.requiresSubTagging,
        createdBy: session!.user.id,
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
    copied += 1;
  }

  await agenda.now(SYNC_READMODEL_JOB, {});
  revalidatePath("/tagging");
  return { ok: true, data: { copied, unmatched } };
}

/* --------------------------- F-09 Nomenklatur SIPD ------------------------- */

export async function listNomenclatureChanges() {
  const SipdNomenclatureChangeModel = await getSipdNomenclatureChangeModel();
  return SipdNomenclatureChangeModel.find({}).sort({ detectedAt: -1 }).limit(100).lean();
}

/* ------------------------- Pohon Anggaran + Tag Efektif -------------------- */

type EffectiveTag = {
  taggingId: string;
  themeId: string;
  themeName: string;
  colorHex: string;
  coverage: "penuh" | "sebagian";
  coveragePercent: number | null;
  inheritedFromName: string | null; // null = tag langsung; berisi nama induk kalau cascade
};

/**
 * Membangun pohon Program → Kegiatan → Subkegiatan untuk tahun tertentu,
 * masing-masing leaf (subkegiatan) dilengkapi daftar tag EFEKTIF (gabungan
 * tag langsung + warisan cascade dari Program/Kegiatan induknya) — lihat
 * penjelasan desain lengkap di packages/db/src/models/Tagging.ts.
 */
export async function listBudgetTreeWithTags(budgetYear: number) {
  const BudgetStructureModel = await getBudgetStructureModel();
  const TaggingModel = await getTaggingModel();
  const ThemeModel = await getThemeModel();

  const [allStructures, allTaggings, allThemes] = await Promise.all([
    BudgetStructureModel.find({ budgetYear }).sort({ sipdCode: 1 }).lean(),
    TaggingModel.find({ budgetYear }).lean(),
    ThemeModel.find({}).lean(),
  ]);

  const themeById = new Map(allThemes.map((t) => [t._id.toString(), t]));
  const structureById = new Map(allStructures.map((s) => [s._id.toString(), s]));
  const taggingsByStructureId = new Map<string, typeof allTaggings>();
  for (const tag of allTaggings) {
    const key = tag.budgetStructureId.toString();
    if (!taggingsByStructureId.has(key)) taggingsByStructureId.set(key, []);
    taggingsByStructureId.get(key)!.push(tag);
  }

  function effectiveTagsFor(structureId: string, path: string[]): EffectiveTag[] {
    const chain = [structureId, ...path]; // diri sendiri + seluruh leluhur
    const result: EffectiveTag[] = [];
    for (const ancestorId of chain) {
      const tags = taggingsByStructureId.get(ancestorId) ?? [];
      for (const tag of tags) {
        const theme = themeById.get(tag.themeId.toString());
        if (!theme) continue;
        result.push({
          taggingId: tag._id.toString(),
          themeId: tag.themeId.toString(),
          themeName: theme.name,
          colorHex: theme.colorHex,
          coverage: tag.coverage as "penuh" | "sebagian",
          coveragePercent: tag.coveragePercent ?? null,
          inheritedFromName:
            ancestorId === structureId ? null : structureById.get(ancestorId)?.name ?? null,
        });
      }
    }
    return result;
  }

  type Node = {
    _id: string;
    level: string;
    name: string;
    pagu: number;
    ownerWorkUnitId: string | null;
    children: Node[];
    tags?: EffectiveTag[];
  };

  const childCounts = new Map<string, number>();
  for (const s of allStructures) {
    if (s.parentId) {
      const key = s.parentId.toString();
      childCounts.set(key, (childCounts.get(key) ?? 0) + 1);
    }
  }

  const nodesById = new Map<string, Node>();
  for (const s of allStructures) {
    const isLeaf = !childCounts.has(s._id.toString());
    nodesById.set(s._id.toString(), {
      _id: s._id.toString(),
      level: s.level,
      name: s.name,
      pagu: s.pagu,
      ownerWorkUnitId: s.ownerWorkUnitId?.toString() ?? null,
      children: [],
      // Tag efektif dihitung untuk LEAF NODE APA PUN — bukan dikunci ke level
      // "subkegiatan" — karena data RPJMD asli sering kali baru sampai level
      // Program (lihat komentar seedExampleBudgetStructure). Struktur SIPD
      // sungguhan yang lengkap sampai subkegiatan tetap tertangani sama baiknya
      // karena subkegiatan pasti berstatus leaf juga.
      tags: isLeaf ? effectiveTagsFor(s._id.toString(), (s.path ?? []).map(String)) : undefined,
    });
  }

  const roots: Node[] = [];
  for (const s of allStructures) {
    const node = nodesById.get(s._id.toString())!;
    if (s.parentId) {
      nodesById.get(s.parentId.toString())?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
