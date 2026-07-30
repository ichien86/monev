"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { listMyNotifications, markNotificationRead, markAllNotificationsRead } from "./notifications.actions";

type NotificationItem = {
  _id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

const TYPE_DOT: Record<string, string> = {
  info: "bg-info",
  warning: "bg-accent",
  success: "bg-success",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = async () => {
    const result = await listMyNotifications();
    setItems(result.items as unknown as NotificationItem[]);
    setUnreadCount(result.unreadCount);
  };

  useEffect(() => {
    load();
    // Polling ringan (bukan WebSocket) — cukup untuk skala pengguna internal
    // Pemkab, konsisten dengan pola F-04 di DDT Section 6.1.
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative" aria-label="Notifikasi">
        <Bell size={18} className="text-muted" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-danger text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-3 w-80 bg-surface border border-border rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-ink">Notifikasi</span>
              {unreadCount > 0 && (
                <button
                  onClick={async () => {
                    await markAllNotificationsRead();
                    load();
                  }}
                  className="text-[11px] text-primary font-semibold"
                >
                  Tandai semua dibaca
                </button>
              )}
            </div>
            {items.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-faint">Belum ada notifikasi.</div>
            )}
            {items.map((n) => (
              <button
                key={n._id}
                onClick={async () => {
                  if (!n.isRead) {
                    await markNotificationRead(n._id);
                    load();
                  }
                }}
                className="w-full text-left px-4 py-3 border-b border-border last:border-b-0 block"
                style={{ background: n.isRead ? "transparent" : "#FAF0DA22" }}
              >
                <div className="flex items-start gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${TYPE_DOT[n.type] ?? "bg-muted"}`} />
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold text-ink">{n.title}</div>
                    <div className="text-[11.5px] text-muted mt-0.5">{n.message}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
