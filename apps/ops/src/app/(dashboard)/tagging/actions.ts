"use server";

import ExcelJS from "exceljs";
import type { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  getThemeModel,
  getBudgetStructureModel,
  getTaggingModel,
  getOrgUnitModel,
  getSipdNomenclatureChangeModel,
  getUserModel,
} from "@simonev/db";
import {
  createThemeSchema,
  importBudgetStructureSchema,
  createTaggingSchema,
  setPartialAllocationsSchema,
  type CreateThemeInput,
  type ImportBudgetStructureInput,
  type CreateTaggingInput,
  type SetPartialAllocationsInput,
} from "@simonev/schemas";
import type { ActionResult } from "@/lib/action-result";
import { agenda } from "@/worker/agenda";
import { SYNC_READMODEL_JOB } from "@/worker/jobs/syncReadmodel.job";
import { notify } from "@/lib/notify";

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
 * DDT v2.0 Section 2.6/3.6 — impor Laporan Realisasi granularitas Rekening
 * (mengganti impor SIPD level-Program v1.0). Mengisi `pagu`+`realisasi`
 * sekaligus per baris, sampai level `program`→`kegiatan`→`subkegiatan`→
 * `rekening`. Sub-SKPD dalam file sumber SENGAJA diabaikan sebagai level
 * terpisah — baris dengan Sub-SKPD tetap dipetakan ke `ownerWorkUnitId` PD
 * induknya lewat kolom Kode SKPD (bukan Kode Sub SKPD). Kolom Fungsi/Sub
 * Fungsi diabaikan sepenuhnya (tidak dipetakan ke field apa pun).
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
  const changedRekeningSipdCodes = new Set<string>();
  for (const level of ["program", "kegiatan", "subkegiatan", "rekening"] as const) {
    const levelRows = rows.filter((r) => r.level === level);
    for (const row of levelRows) {
      let parentId = null;
      let path: Types.ObjectId[] = [];
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
        // `path` dihitung manual di sini (bukan mengandalkan pre("save") hook
        // di BudgetStructure.ts) -- upsert di bawah memakai findOneAndUpdate,
        // yaitu query middleware yang TIDAK memicu document middleware
        // pre("save") sama sekali, jadi path akan selalu kosong kalau tidak
        // diisi eksplisit di sini (baris di atasnya diproses level-by-level,
        // jadi induk sudah pasti sudah ter-upsert lebih dulu di loop ini).
        path = [...(parent.path ?? []), parent._id];
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

      // DDT v2.0 3.6 langkah 4 — tangkap realisasi LAMA (sebelum ditimpa)
      // untuk rekening yang berubah, dipakai trigger notifikasi tagging di
      // bawah setelah seluruh baris tahun ini tersimpan.
      if (row.level === "rekening") {
        const existing = await BudgetStructureModel.findOne({ sipdCode: row.sipdCode, budgetYear })
          .select("realisasi")
          .lean();
        if (existing && existing.realisasi !== row.realisasi) {
          changedRekeningSipdCodes.add(row.sipdCode);
        }
      }

      await BudgetStructureModel.findOneAndUpdate(
        { sipdCode: row.sipdCode, budgetYear },
        {
          level: row.level,
          sipdCode: row.sipdCode,
          parentId,
          path,
          name: row.name,
          budgetYear,
          pagu: row.pagu,
          realisasi: row.realisasi,
          realisasiUpdatedAt: new Date(),
          ownerWorkUnitId: row.ownerWorkUnitSipdCode
            ? orgUnitsBySipd.get(row.ownerWorkUnitSipdCode) ?? null
            : null,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      imported += 1;
    }
  }

  if (changedRekeningSipdCodes.size > 0) {
    await notifyTaggedRekeningOnRealisasiChange(budgetYear, changedRekeningSipdCodes);
  }

  await agenda.now(SYNC_READMODEL_JOB, {});
  revalidatePath("/tagging");
  return { ok: true, data: { imported } };
}

/**
 * DDT v2.0 Section 3.6 langkah 4 — setelah impor selesai, untuk tiap
 * rekening yang REALISASI-nya berubah dan muncul di `Tagging.partialAllocations`
 * manapun, kirim notify() ke seluruh pengguna aktif PD pengampu subkegiatan
 * terkait.
 */
async function notifyTaggedRekeningOnRealisasiChange(budgetYear: number, changedSipdCodes: Set<string>) {
  const TaggingModel = await getTaggingModel();
  const BudgetStructureModel = await getBudgetStructureModel();
  const UserModel = await getUserModel();

  const changedRekening = await BudgetStructureModel.find({
    budgetYear,
    level: "rekening",
    sipdCode: { $in: Array.from(changedSipdCodes) },
  })
    .select("ownerWorkUnitId name realisasi")
    .lean();
  if (changedRekening.length === 0) return;
  const changedRekeningIds = new Set(changedRekening.map((r) => r._id.toString()));

  const taggings = await TaggingModel.find({
    budgetYear,
    coverage: "sebagian",
    "partialAllocations.rekeningStructureId": { $in: Array.from(changedRekeningIds) },
  })
    .populate("themeId", "name")
    .lean();
  if (taggings.length === 0) return;

  const rekeningById = new Map(changedRekening.map((r) => [r._id.toString(), r]));
  const notifiedPerRekening = new Set<string>();

  for (const tag of taggings) {
    for (const allocation of tag.partialAllocations) {
      const rekeningId = allocation.rekeningStructureId.toString();
      if (!changedRekeningIds.has(rekeningId) || notifiedPerRekening.has(rekeningId)) continue;
      const rekening = rekeningById.get(rekeningId);
      if (!rekening?.ownerWorkUnitId) continue;
      notifiedPerRekening.add(rekeningId);

      const recipients = await UserModel.find({ workUnitId: rekening.ownerWorkUnitId, isActive: true })
        .select("_id")
        .lean();
      for (const recipient of recipients) {
        await notify({
          userId: recipient._id.toString(),
          type: "info",
          title: "Realisasi rekening ter-tag diperbarui",
          message: `Realisasi "${rekening.name}" (ter-tag tema "${(tag.themeId as any)?.name ?? "?"}") diperbarui menjadi Rp ${rekening.realisasi.toLocaleString("id-ID")}.`,
          link: "/tagging",
        });
      }
    }
  }
}

/**
 * Impor SIPD dari file Excel sungguhan (.xlsx) — pelengkap `importBudgetStructure`
 * di atas (yang menerima baris terstruktur/JSON). Format kolom yang
 * diharapkan pada baris header (case-insensitive): Level | Kode SIPD | Kode
 * Induk | Nama | Pagu | Realisasi | Kode SKPD. Baris pertama SELALU
 * dianggap header dan dilewati. Kolom Fungsi/Sub Fungsi (jika ada di file
 * sumber Laporan Realisasi) TIDAK dipetakan — diabaikan sepenuhnya.
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
    level: "program" | "kegiatan" | "subkegiatan" | "rekening";
    sipdCode: string;
    parentSipdCode: string | null;
    name: string;
    pagu: number;
    realisasi: number;
    ownerWorkUnitSipdCode: string | null;
  }[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // lewati header
    const [, levelRaw, sipdCode, parentSipdCode, name, paguRaw, realisasiRaw, ownerSipdCode] =
      row.values as unknown[];
    if (!sipdCode || !name) return; // baris kosong/pemisah, lewati

    const level = String(levelRaw ?? "").trim().toLowerCase();
    if (!["program", "kegiatan", "subkegiatan", "rekening"].includes(level)) return;

    rows.push({
      level: level as "program" | "kegiatan" | "subkegiatan" | "rekening",
      sipdCode: String(sipdCode).trim(),
      parentSipdCode: parentSipdCode ? String(parentSipdCode).trim() : null,
      name: String(name).trim(),
      pagu: Number(paguRaw) || 0,
      realisasi: Number(realisasiRaw) || 0,
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
    partialAllocations: [],
    createdBy: session!.user.id,
  });
  await agenda.now(SYNC_READMODEL_JOB, {});
  revalidatePath("/tagging");
  return { ok: true, data: { id: created._id.toString() } };
}

/**
 * DDT v2.0 Section 2.7 — menggantikan enterSplitCoverage (persentase
 * tunggal, v1.0). PD hanya boleh mengisi alokasi untuk rekening di bawah
 * subkegiatan milik OPD-nya sendiri — dicek lewat BudgetStructure.ownerWorkUnitId.
 */
export async function setPartialAllocations(input: SetPartialAllocationsInput): Promise<ActionResult> {
  const session = await auth();
  if (session?.user.role !== "pd_opd" || !session.user.workUnitId) {
    return { ok: false, error: "Hanya operator PD yang dapat mengentri alokasi rekening." };
  }
  const parsed = setPartialAllocationsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };

  const TaggingModel = await getTaggingModel();
  const BudgetStructureModel = await getBudgetStructureModel();

  const tagging = await TaggingModel.findById(parsed.data.taggingId);
  if (!tagging || tagging.coverage !== "sebagian") {
    return { ok: false, error: "Tagging tidak ditemukan atau bukan bercakupan sebagian." };
  }

  const structure = await BudgetStructureModel.findById(tagging.budgetStructureId).lean();
  if (!structure || String(structure.ownerWorkUnitId) !== session.user.workUnitId) {
    return { ok: false, error: "Anda tidak berwenang mengentri alokasi untuk struktur anggaran ini." };
  }

  const rekeningIds = parsed.data.allocations.map((a) => a.rekeningStructureId);
  const rekeningCount = await BudgetStructureModel.countDocuments({
    _id: { $in: rekeningIds },
    level: "rekening",
    parentId: tagging.budgetStructureId,
  });
  if (rekeningCount !== rekeningIds.length) {
    return { ok: false, error: "Salah satu rekening tidak ditemukan di bawah subkegiatan ini." };
  }

  tagging.partialAllocations = parsed.data.allocations.map((a) => ({
    rekeningStructureId: a.rekeningStructureId as any,
    amountRupiah: a.amountRupiah,
    lastConfirmedBy: session.user.id as any,
    lastConfirmedAt: new Date(),
  })) as any;
  await tagging.save();

  await agenda.now(SYNC_READMODEL_JOB, {});
  revalidatePath("/tagging");
  return { ok: true, data: undefined };
}

/**
 * Data contoh — BUKAN pengganti impor realisasi sungguhan. Memakai baris
 * program riil dari Tabel IV.1 RPJMD Kabupaten Boyolali 2025–2029 (pagu
 * indikatif 2026) supaya modul ini langsung punya isi yang bermakna untuk
 * demo/dev, konsisten dengan seed script F-01. Untuk produksi, gunakan
 * `importBudgetStructure` dengan hasil parsing Excel Laporan Realisasi
 * sungguhan.
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
        realisasi: 0,
        ownerWorkUnitSipdCode: dinkes?.sipdCode ?? null,
      },
      {
        level: "program",
        sipdCode: "1.06.05",
        parentSipdCode: null,
        name: "Program Perlindungan dan Jaminan Sosial",
        pagu: 5803250000,
        realisasi: 0,
        ownerWorkUnitSipdCode: dinsos?.sipdCode ?? null,
      },
      {
        level: "program",
        sipdCode: "2.09.03",
        parentSipdCode: null,
        name: "Program Peningkatan Diversifikasi dan Ketahanan Pangan Masyarakat",
        pagu: 1104672000,
        realisasi: 0,
        ownerWorkUnitSipdCode: dkp?.sipdCode ?? null,
      },
      {
        level: "program",
        sipdCode: "2.09.05",
        parentSipdCode: null,
        name: "Program Pengawasan Keamanan Pangan",
        pagu: 111000000,
        realisasi: 0,
        ownerWorkUnitSipdCode: dkp?.sipdCode ?? null,
      },
    ],
  });
}

/**
 * F-02 — copy-advice antar tahun (PRD 5.6, DDT v2.0 Section 2.7): mencocokkan
 * struktur tahun sebelumnya dengan tahun berjalan BERBASIS KODE SIPD. Item
 * dengan kode yang cocok DAN punya anggaran di tahun berjalan → auto-copy
 * tagging-nya. `partialAllocations` TIDAK ikut disalin — wajib dientri ulang
 * PD di tahun baru (nominal Rupiah tahun lalu tidak relevan untuk pagu/
 * realisasi tahun baru).
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
        partialAllocations: [], // sengaja TIDAK disalin — wajib dientri ulang PD di tahun baru
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
  amountRupiah: number | null; // hanya terisi untuk coverage="sebagian"
  inheritedFromName: string | null; // null = tag langsung; berisi nama induk kalau cascade
};

/**
 * Membangun pohon Program → Kegiatan → Subkegiatan → Rekening untuk tahun
 * tertentu. DDT v2.0 — `Tagging.budgetStructureId` secara arsitektur SELALU
 * mengacu ke level Subkegiatan (lihat Tagging.ts), tapi algoritma cascade di
 * sini tetap generik (jalan untuk level manapun) — konsisten dengan v1.0,
 * lihat penjelasan desain lengkap di packages/db/src/models/Tagging.ts.
 * Untuk coverage="sebagian", tag HANYA melekat ke rekening yang benar-benar
 * disebut di `partialAllocations` (bukan seluruh descendant seperti
 * coverage="penuh").
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

        if (tag.coverage === "penuh") {
          result.push({
            taggingId: tag._id.toString(),
            themeId: tag.themeId.toString(),
            themeName: theme.name,
            colorHex: theme.colorHex,
            coverage: "penuh",
            amountRupiah: null,
            inheritedFromName: ancestorId === structureId ? null : structureById.get(ancestorId)?.name ?? null,
          });
          continue;
        }

        // coverage === "sebagian" — hanya melekat kalau rekening INI
        // (structureId, bukan ancestorId) benar-benar terdaftar di alokasi.
        const allocation = tag.partialAllocations.find((a) => a.rekeningStructureId.toString() === structureId);
        if (!allocation) continue;
        result.push({
          taggingId: tag._id.toString(),
          themeId: tag.themeId.toString(),
          themeName: theme.name,
          colorHex: theme.colorHex,
          coverage: "sebagian",
          amountRupiah: allocation.amountRupiah,
          inheritedFromName: ancestorId === structureId ? null : structureById.get(ancestorId)?.name ?? null,
        });
      }
    }
    return result;
  }

  type SubkegiatanTag = {
    taggingId: string;
    themeId: string;
    themeName: string;
    colorHex: string;
    coverage: "penuh" | "sebagian";
    allocatedCount: number;
    allocatedTotal: number;
  };

  type Node = {
    _id: string;
    level: string;
    name: string;
    pagu: number;
    realisasi: number;
    ownerWorkUnitId: string | null;
    children: Node[];
    tags?: EffectiveTag[];
    subkegiatanTags?: SubkegiatanTag[];
  };

  const childCounts = new Map<string, number>();
  for (const s of allStructures) {
    if (s.parentId) {
      const key = s.parentId.toString();
      childCounts.set(key, (childCounts.get(key) ?? 0) + 1);
    }
  }

  // Tag yang melekat LANGSUNG ke subkegiatan itu sendiri (bukan hasil cascade
  // ke rekening lewat effectiveTagsFor) -- dipakai supaya PD punya titik masuk
  // untuk mengisi alokasi pertama kali pada tag coverage="sebagian" yang
  // partialAllocations-nya masih kosong (tidak akan pernah muncul di leaf
  // manapun sampai ada alokasi, jadi harus terlihat di level subkegiatan).
  function subkegiatanTagsFor(subkegiatanId: string): SubkegiatanTag[] {
    const tags = taggingsByStructureId.get(subkegiatanId) ?? [];
    const result: SubkegiatanTag[] = [];
    for (const tag of tags) {
      const theme = themeById.get(tag.themeId.toString());
      if (!theme) continue;
      result.push({
        taggingId: tag._id.toString(),
        themeId: tag.themeId.toString(),
        themeName: theme.name,
        colorHex: theme.colorHex,
        coverage: tag.coverage,
        allocatedCount: tag.partialAllocations.length,
        allocatedTotal: tag.partialAllocations.reduce((sum, a) => sum + a.amountRupiah, 0),
      });
    }
    return result;
  }

  const nodesById = new Map<string, Node>();
  for (const s of allStructures) {
    const isLeaf = !childCounts.has(s._id.toString());
    nodesById.set(s._id.toString(), {
      _id: s._id.toString(),
      level: s.level,
      name: s.name,
      pagu: s.pagu,
      realisasi: s.realisasi,
      ownerWorkUnitId: s.ownerWorkUnitId?.toString() ?? null,
      children: [],
      tags: isLeaf ? effectiveTagsFor(s._id.toString(), (s.path ?? []).map(String)) : undefined,
      subkegiatanTags: s.level === "subkegiatan" ? subkegiatanTagsFor(s._id.toString()) : undefined,
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

/** Rekening di bawah satu Subkegiatan — dipakai form alokasi partial (PartialAllocationModal). */
export async function listRekeningUnderSubkegiatan(subkegiatanId: string) {
  const BudgetStructureModel = await getBudgetStructureModel();
  return BudgetStructureModel.find({ parentId: subkegiatanId, level: "rekening" })
    .select("name sipdCode pagu realisasi")
    .sort({ sipdCode: 1 })
    .lean();
}

/**
 * Data gabungan untuk PartialAllocationModal — daftar rekening di bawah
 * subkegiatan tagging ini + alokasi yang sudah tersimpan, dalam satu
 * panggilan (dipicu dari tombol "Ubah Alokasi" pada rekening manapun yang
 * sudah punya tag, cukup modal tahu taggingId-nya).
 */
export async function getTaggingAllocationEditor(taggingId: string) {
  const TaggingModel = await getTaggingModel();
  const tagging = await TaggingModel.findById(taggingId).lean();
  if (!tagging) return null;

  const rekeningOptions = await listRekeningUnderSubkegiatan(tagging.budgetStructureId.toString());
  return {
    taggingId: tagging._id.toString(),
    allocations: tagging.partialAllocations.map((a) => ({
      rekeningStructureId: a.rekeningStructureId.toString(),
      amountRupiah: a.amountRupiah,
    })),
    rekeningOptions: rekeningOptions.map((r) => ({
      _id: r._id.toString(),
      name: r.name,
      sipdCode: r.sipdCode,
      pagu: r.pagu,
      realisasi: r.realisasi,
    })),
  };
}
