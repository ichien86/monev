import nodemailer from "nodemailer";
import { getNotificationModel, getUserModel } from "@simonev/db";
import type { NotificationType } from "@simonev/db";

/**
 * F-12 — Notifikasi & Smart Reminder. Selalu menulis notifikasi in-app
 * (sumber kebenaran utama — pengguna tetap bisa lihat riwayat notifikasi
 * walau tidak pernah cek email). Email SMTP bersifat best-effort: kalau
 * env SMTP_* belum diisi atau server SMTP gagal, fungsi ini TIDAK melempar
 * error — hanya mencatat ke console — supaya job/Server Action pemanggilnya
 * (mis. validateEvidence, reviewSubmission) tidak pernah gagal gara-gara
 * notifikasi.
 */
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export async function notify(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  const NotificationModel = await getNotificationModel();
  await NotificationModel.create({
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link ?? null,
  });

  try {
    const smtp = getTransporter();
    if (!smtp) return; // SMTP belum dikonfigurasi — notifikasi in-app tetap tersimpan di atas.

    const UserModel = await getUserModel();
    const user = await UserModel.findById(params.userId).lean();
    if (!user?.email) return;

    await smtp.sendMail({
      from: process.env.SMTP_FROM ?? "SIMONEV Boyolali <simonev@boyolalikab.go.id>",
      to: user.email,
      subject: params.title,
      text: params.message,
    });
  } catch (error) {
    console.warn("[notify] Gagal mengirim email (notifikasi in-app tetap tersimpan):", error);
  }
}
