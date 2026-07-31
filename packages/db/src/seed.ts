/**
 * Seed data development — dijalankan lewat `npm run seed` di root repo.
 * Mengisi: 4 Perangkat Daerah, 4 akun (satu per role), dan satu cabang nyata
 * Pohon Kinerja (Visi → Misi 3 → Tujuan 2 → Sasaran 2.1 → Tujuan PD Dinkes →
 * Sasaran Strategis PD → Sasaran Program) mengutip RPJMD Kabupaten Boyolali
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
} from "./index";

const DEV_PASSWORD = "SimonevDev2026!";

async function main() {
  await connectCore();
  const UserModel = await getUserModel();
  const OrgUnitModel = await getOrgUnitModel();
  const IndicatorModel = await getIndicatorModel();
  const ThemeModel = await getThemeModel();

  console.log("Menghapus data seed lama (jika ada)...");
  await Promise.all([
    UserModel.deleteMany({ email: { $regex: /@boyolalikab\.go\.id$/ } }),
    OrgUnitModel.deleteMany({}),
    IndicatorModel.deleteMany({}),
    ThemeModel.deleteMany({}),
  ]);

  console.log("Mengisi Perangkat Daerah...");
  const [dinkes] = await OrgUnitModel.create([
    {
      name: "Dinas Kesehatan",
      sipdCode: "1.02.0.00.0.00.01.0000",
      urusan: ["Kesehatan"],
    },
    {
      name: "Dinas Ketahanan Pangan",
      sipdCode: "2.09.0.00.0.00.01.0000",
      urusan: ["Ketahanan Pangan"],
    },
    {
      name: "Dinas Sosial",
      sipdCode: "1.06.0.00.0.00.01.0000",
      urusan: ["Sosial"],
    },
    {
      name: "Dinas Peternakan dan Perikanan",
      sipdCode: "3.27.0.00.3.25.01.0000",
      urusan: ["Peternakan", "Perikanan"],
    },
  ]);

  console.log("Mengisi akun pengguna (satu per role)...");
  const passwordHash = await argon2.hash(DEV_PASSWORD);
  const [, bapperidaUser] = await UserModel.create([
    { name: "Admin Sistem", email: "admin@boyolalikab.go.id", passwordHash, role: "admin_sistem" },
    { name: "Bapperida — Bidang Litbang", email: "bapperida@boyolalikab.go.id", passwordHash, role: "bapperida" },
    { name: "Sekretaris Daerah", email: "pimpinan@boyolalikab.go.id", passwordHash, role: "pimpinan" },
    {
      name: "Operator Dinas Kesehatan",
      email: "dinkes@boyolalikab.go.id",
      passwordHash,
      role: "pd_opd",
      workUnitId: dinkes._id,
    },
  ]);

  console.log("Mengisi tema tagging (F-02)...");
  await ThemeModel.create([
    { name: "Stunting", colorHex: "#B23A2E", createdBy: bapperidaUser._id },
    { name: "Kemiskinan Ekstrem", colorHex: "#4A6FA5", createdBy: bapperidaUser._id },
    { name: "Ketahanan Pangan", colorHex: "#2F7A4C", createdBy: bapperidaUser._id },
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
    calculationMethod: "last_period",
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
    { email: "admin@boyolalikab.go.id", role: "admin_sistem" },
    { email: "bapperida@boyolalikab.go.id", role: "bapperida" },
    { email: "pimpinan@boyolalikab.go.id", role: "pimpinan (login di SIMONEV Eksekutif)" },
    { email: "dinkes@boyolalikab.go.id", role: "pd_opd" },
  ]);
  console.log(`Kata sandi untuk semua akun di atas: ${DEV_PASSWORD}`);

  process.exit(0);
}

main().catch((error) => {
  console.error("Seed gagal:", error);
  process.exit(1);
});
