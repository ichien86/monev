"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getNotificationModel } from "@simonev/db";
import type { ActionResult } from "@/lib/action-result";

export async function listMyNotifications() {
  const session = await auth();
  if (!session?.user.id) return { items: [], unreadCount: 0 };

  const NotificationModel = await getNotificationModel();
  const [items, unreadCount] = await Promise.all([
    NotificationModel.find({ userId: session.user.id }).sort({ createdAt: -1 }).limit(20).lean(),
    NotificationModel.countDocuments({ userId: session.user.id, isRead: false }),
  ]);
  return { items, unreadCount };
}

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user.id) return { ok: false, error: "Belum login." };

  const NotificationModel = await getNotificationModel();
  await NotificationModel.updateOne(
    { _id: notificationId, userId: session.user.id },
    { $set: { isRead: true } }
  );
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user.id) return { ok: false, error: "Belum login." };

  const NotificationModel = await getNotificationModel();
  await NotificationModel.updateMany({ userId: session.user.id, isRead: false }, { $set: { isRead: true } });
  revalidatePath("/");
  return { ok: true, data: undefined };
}
