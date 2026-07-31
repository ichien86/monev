import Link from "next/link";
import { auth, signOut } from "@/auth";
import type { UserRole } from "@simonev/db";
import { NotificationBell } from "./_components/NotificationBell";

const NAV: { href: string; label: string; roles: UserRole[] }[] = [
  { href: "/pohon-kinerja", label: "Pohon Kinerja", roles: ["bapperida", "admin_sistem", "pd_opd"] },
  { href: "/input-data", label: "Input Data & Bukti", roles: ["pd_opd"] },
  { href: "/rekonsiliasi", label: "Rekonsiliasi & Approval", roles: ["bapperida"] },
  { href: "/tagging", label: "Tagging Anggaran Tematik", roles: ["bapperida", "admin_sistem", "pd_opd"] },
  { href: "/jadwal", label: "Penjadwalan & Penguncian", roles: ["bapperida", "admin_sistem"] },
  { href: "/simulasi", label: "Simulasi What-If", roles: ["bapperida", "admin_sistem"] },
  { href: "/laporan", label: "Tabel Data & Ekspor", roles: ["bapperida", "admin_sistem", "pd_opd"] },
  { href: "/org-unit", label: "Perangkat Daerah", roles: ["admin_sistem"] },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = session?.user.role;
  const visibleNav = NAV.filter((item) => !role || item.roles.includes(role));

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-primary-deep flex flex-col shrink-0">
        <div className="h-[68px] flex items-center gap-3 px-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-accent font-display font-semibold">
            S
          </div>
          <div>
            <div className="font-display text-white text-base font-semibold leading-none">SIMONEV</div>
            <div className="text-[10px] font-mono text-white/50 tracking-wide mt-1">OPS · BOYOLALI</div>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2.5 rounded-lg text-sm font-medium text-white/75 hover:bg-primary hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10">
          <div className="text-xs text-white/70">{session?.user.name}</div>
          <div className="text-[10px] font-mono text-white/40 uppercase mt-0.5">{role}</div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="text-[11px] text-white/50 hover:text-white mt-2" type="submit">
              Keluar
            </button>
          </form>
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-[68px] flex items-center justify-end px-6 border-b border-border bg-surface shrink-0">
          <NotificationBell />
        </div>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
