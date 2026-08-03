/**
 * Seed data development — dijalankan lewat `npm run seed` di root repo.
 * Mengisi: 9 Urusan + Bidang Urusan turunannya (referensi, DDT v2.0 2.8),
 * 4 Perangkat Daerah, 4 akun (satu per role, login berbasis username), Tahun
 * Aktif, beberapa Variable master data, satu Program (untuk linkedProgramId),
 * dan satu cabang nyata Pohon Kinerja (Visi → Misi 3 → Tujuan 2 → Sasaran 2.1
 * → Tujuan PD Dinkes → Sasaran Strategis PD → Sasaran Program, dengan formula
 * berbasis Variable, DDT v2.0 Section 2.2) mengutip RPJMD Kabupaten Boyolali
 * 2025–2029 — data yang sama dipakai di mockup UI, supaya begitu aplikasi
 * nyata dijalankan, tampilannya langsung punya isi yang familiar bagi Bapperida.
 *
 * TIDAK untuk dijalankan di produksi apa adanya — kata sandi di bawah hanya
 * untuk development lokal, WAJIB diganti sebelum go-live.
 */
import argon2 from "argon2";
import {
  connectCore,
  getUserModel,
  getOrgUnitModel,
  getIndicatorModel,
  getThemeModel,
  getUrusanModel,
  getBidangUrusanModel,
  getSystemSettingModel,
  getVariableModel,
  getBudgetStructureModel,
} from "./index";

const DEV_PASSWORD = "SimonevDev2026!";
const TAHUN_AKTIF = 2026;

/** DDT v2.0 Section 2.8 — 9 Urusan + Bidang Urusan turunannya, referensi statis (bukan hasil impor tahunan). */
const URUSAN_REFERENCE: { code: string; name: string; bidang: string[] }[] = [
  { code: "1.01", name: "Pendidikan", bidang: ["PAUD dan Pendidikan Non-Formal", "Pendidikan Dasar", "Pendidikan Menengah", "Ketenagaan Pendidikan"] },
  {
    code: "1.02",
    name: "Kesehatan",
    bidang: [
      "Pelayanan Kesehatan",
      "Kesehatan Masyarakat",
      "Pencegahan & Pengendalian Penyakit",
      "Sumber Daya Kesehatan",
      "Kefarmasian & Alat Kesehatan",
    ],
  },
  { code: "1.03", name: "Pekerjaan Umum dan Penataan Ruang", bidang: ["Sumber Daya Air", "Bina Marga", "Cipta Karya", "Tata Ruang"] },
  { code: "1.04", name: "Perumahan Rakyat dan Kawasan Permukiman", bidang: ["Perumahan", "Kawasan Permukiman", "Prasarana Sarana Utilitas Umum"] },
  { code: "1.05", name: "Ketenteraman, Ketertiban Umum, dan Perlindungan Masyarakat", bidang: ["Ketenteraman & Ketertiban Umum", "Penanggulangan Bencana", "Kebakaran"] },
  {
    code: "1.06",
    name: "Sosial",
    bidang: [
      "Rehabilitasi Sosial",
      "Perlindungan & Jaminan Sosial",
      "Pemberdayaan Sosial",
      "Penanganan Bencana Sosial",
      "Taman Makam Pahlawan",
    ],
  },
  { code: "2.09", name: "Pangan", bidang: ["Ketahanan Pangan", "Penganekaragaman Konsumsi Pangan", "Kerawanan Pangan", "Keamanan Pangan"] },
  {
    code: "3.25",
    name: "Pertanian",
    bidang: [
      "Prasarana & Sarana Pertanian",
      "Kesehatan Hewan & Kesmavet",
      "Perbibitan & Produksi Ternak",
      "Peternakan",
      "Perkebunan",
      "Penyuluhan Pertanian",
    ],
  },
  {
    code: "3.27",
    name: "Kelautan dan Perikanan",
    bidang: [
      "Perikanan Tangkap",
      "Perikanan Budidaya",
      "Pengolahan & Pemasaran Hasil Perikanan",
      "Perikanan",
      "Pengawasan Sumber Daya Kelautan Perikanan",
    ],
  },
];

async function main() {
  await connectCore();
  const UserModel = await getUserModel();
  const OrgUnitModel = await getOrgUnitModel();
  const IndicatorModel = await getIndicatorModel();
  const ThemeModel = await getThemeModel();
  const UrusanModel = await getUrusanModel();
  const BidangUrusanModel = await getBidangUrusanModel();
  const SystemSettingModel = await getSystemSettingModel();
  const VariableModel = await getVariableModel();
  const BudgetStructureModel = await getBudgetStructureModel();

  console.log("Menghapus data seed lama (jika ada)...");
  await Promise.all([
    UserModel.deleteMany({ username: { $in: ["admin", "bapperida", "pimpinan", "dinkes"] } }),
    OrgUnitModel.deleteMany({}),
    IndicatorModel.deleteMany({}),
    ThemeModel.deleteMany({}),
    UrusanModel.deleteMany({}),
    BidangUrusanModel.deleteMany({}),
    VariableModel.deleteMany({}),
    BudgetStructureModel.deleteMany({ budgetYear: TAHUN_AKTIF }),
  ]);

  console.log("Mengisi referensi Urusan & Bidang Urusan (DDT v2.0 2.8)...");
  const bidangIdByName = new Map<string, any>();
  for (const u of URUSAN_REFERENCE) {
    const urusanDoc = await UrusanModel.create({ code: u.code, name: u.name });
    for (const [i, bidangName] of u.bidang.entries()) {
      const bidangDoc = await BidangUrusanModel.create({
        code: `${u.code}.${i + 1}`,
        name: bidangName,
        urusanId: urusanDoc._id,
      });
      bidangIdByName.set(bidangName, bidangDoc._id);
    }
  }

  const passwordHash = await argon2.hash(DEV_PASSWORD);

  console.log("Mengisi Perangkat Daerah...");
  const [dinkes] = await OrgUnitModel.create([
    {
      name: "Dinas Kesehatan",
      sipdCode: "1.02.0.00.0.00.01.0000",
      bidangUrusanIds: [bidangIdByName.get("Pelayanan Kesehatan")],
    },
    {
      name: "Dinas Ketahanan Pangan",
      sipdCode: "2.09.0.00.0.00.01.0000",
      bidangUrusanIds: [bidangIdByName.get("Ketahanan Pangan")],
    },
    {
      name: "Dinas Sosial",
      sipdCode: "1.06.0.00.0.00.01.0000",
      bidangUrusanIds: [bidangIdByName.get("Rehabilitasi Sosial")],
    },
    {
      name: "Dinas Peternakan dan Perikanan",
      sipdCode: "3.27.0.00.3.25.01.0000",
      bidangUrusanIds: [bidangIdByName.get("Peternakan"), bidangIdByName.get("Perikanan")],
    },
  ]);

  console.log("Mengisi akun pengguna (satu per role, login berbasis username — DDT v2.0 2.10)...");
  const [adminUser, bapperidaUser] = await UserModel.create([
    { name: "Admin Sistem", username: "admin", email: "admin@boyolalikab.go.id", passwordHash, role: "admin_sistem" },
    {
      name: "Bapperida — Bidang Litbang",
      username: "bapperida",
      email: "bapperida@boyolalikab.go.id",
      passwordHash,
      role: "bapperida",
    },
    { name: "Sekretaris Daerah", username: "pimpinan", email: "pimpinan@boyolalikab.go.id", passwordHash, role: "pimpinan" },
    {
      name: "Operator Dinas Kesehatan",
      username: "dinkes",
      email: "dinkes@boyolalikab.go.id",
      passwordHash,
      role: "pd_opd",
      workUnitId: dinkes._id,
    },
  ]);

  await SystemSettingModel.findByIdAndUpdate(
    "tahun_aktif",
    { _id: "tahun_aktif", value: TAHUN_AKTIF, setBy: adminUser._id, setAt: new Date() },
    { upsert: true }
  );

  console.log("Mengisi tema tagging (F-02)...");
  await ThemeModel.create([
    { name: "Stunting", colorHex: "#B23A2E", createdBy: bapperidaUser._id },
    { name: "Kemiskinan Ekstrem", colorHex: "#4A6FA5", createdBy: bapperidaUser._id },
    { name: "Ketahanan Pangan", colorHex: "#2F7A4C", createdBy: bapperidaUser._id },
  ]);

  console.log("Mengisi Program (untuk linkedProgramId, DDT v2.0 5.1.6)...");
  const programKesehatan = await BudgetStructureModel.create({
    level: "program",
    sipdCode: "1.02.02",
    parentId: null,
    name: "Program Pemenuhan Upaya Kesehatan Perorangan dan Upaya Kesehatan Masyarakat",
    budgetYear: TAHUN_AKTIF,
    pagu: 145098623382,
    realisasi: 0,
    ownerWorkUnitId: dinkes._id,
  });

  console.log("Mengisi Variable master data (DDT v2.0 2.1)...");
  const [variableKunjungan, variablePenduduk] = await VariableModel.create([
    { name: "Jumlah Kunjungan Layanan Kesehatan Ibu dan Anak", unit: "orang", createdBy: bapperidaUser._id },
    { name: "Jumlah Penduduk Sasaran", unit: "orang", createdBy: bapperidaUser._id },
  ]);

  console.log("Mengisi cabang Pohon Kinerja (data riil RPJMD 2025–2029)...");
  const visi = await IndicatorModel.create({
    tier: "VISI",
    parentId: null,
    label:
      "Terwujudnya Perubahan Boyolali yang Maju, Nyaman Dihuni, Berdaya Saing dan Ramah Investasi Menuju Indonesia Emas 2045",
  });

  const misi3 = await IndicatorModel.create({
    tier: "MISI",
    parentId: visi._id,
    label: "Mewujudkan Sumber Daya Manusia Unggul, Sehat, Cerdas dan Berjiwa Pancasila",
  });

  const tujuan2 = await IndicatorModel.create({
    tier: "TUJUAN_DAERAH",
    parentId: misi3._id,
    label: "Meningkatkan Kualitas Sumber Daya Manusia dan Kesejahteraan Masyarakat",
    unit: "%",
    baseline: { year: 2024, value: "9,63" },
    targets: [
      { year: 2026, value: "9,27-9,09" },
      { year: 2029, value: "7,47-7,32" },
    ],
    polarity: "negative",
  });

  const sasaran21 = await IndicatorModel.create({
    tier: "SASARAN_STRATEGIS_DAERAH",
    parentId: tujuan2._id,
    label: "Peningkatan Daya Saing Sumber Daya Manusia",
    unit: "Poin",
    baseline: { year: 2024, value: "75,96" },
    targets: [{ year: 2029, value: "77,91" }],
  });

  const tujuanPdDinkes = await IndicatorModel.create({
    tier: "TUJUAN_PD",
    parentId: sasaran21._id,
    ownerWorkUnitId: dinkes._id,
    label: "Meningkatnya Derajat Kesehatan Masyarakat",
  });

  const sasaranPdStunting = await IndicatorModel.create({
    tier: "SASARAN_STRATEGIS_PD",
    parentId: tujuanPdDinkes._id,
    ownerWorkUnitId: dinkes._id,
    label: "Meningkatnya Pelayanan Kesehatan bagi Kelompok Rentan Khususnya Ibu dan Anak",
  });

  await IndicatorModel.create({
    tier: "SASARAN_PROGRAM",
    parentId: sasaranPdStunting._id,
    ownerWorkUnitId: dinkes._id,
    label: "Program Pemenuhan Upaya Kesehatan Perorangan dan Upaya Kesehatan Masyarakat",
    linkedProgramId: programKesehatan._id,
    calculationMethod: "persentase",
    formula: [
      { variableId: variableKunjungan._id, role: "pembilang", weight: null },
      { variableId: variablePenduduk._id, role: "penyebut", weight: null },
    ],
    variableSources: [
      { variableId: variableKunjungan._id, sourceType: "manual", apiConnectorKey: null },
      { variableId: variablePenduduk._id, sourceType: "manual", apiConnectorKey: null },
    ],
    polarity: "negative",
    allowOverachievement: true,
    periodicity: "tahunan",
    unit: "%",
    baseline: { year: 2024, value: "3" },
    targets: [{ year: 2026, value: "2,3" }],
    classificationTags: ["IKK"],
  });

  console.log("\nSelesai. Kredensial development (GANTI sebelum produksi):");
  console.table([
    { username: "admin", role: "admin_sistem" },
    { username: "bapperida", role: "bapperida (Admin Perencana)" },
    { username: "pimpinan", role: "pimpinan (login di SIMONEV Eksekutif)" },
    { username: "dinkes", role: "pd_opd" },
  ]);
  console.log(`Kata sandi untuk semua akun di atas: ${DEV_PASSWORD}`);

  process.exit(0);
}

main().catch((error) => {
  console.error("Seed gagal:", error);
  process.exit(1);
});
