import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * F-12 — Notifikasi & Smart Reminder (PRD Section 3 F-12). Notifikasi
 * in-app disimpan di sini; pengiriman email (opsional, best-effort) lewat
 * Nodemailer terjadi di apps/ops/src/lib/notify.ts — kegagalan email TIDAK
 * pernah menggagalkan alur bisnis utama (submission/review tetap tersimpan
 * walau SMTP down), hanya dicatat di log.
 */
export const NOTIFICATION_TYPES = ["info", "warning", "success"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: "info" },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, default: null }, // path relatif, mis. "/input-data"
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export type NotificationDoc = InferSchemaType<typeof notificationSchema>;

export async function getNotificationModel(conn?: Connection): Promise<Model<NotificationDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.Notification as Model<NotificationDoc>) ??
    connection.model<NotificationDoc>("Notification", notificationSchema)
  );
}
