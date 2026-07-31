import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIMONEV Ops — Bapperida Kabupaten Boyolali",
  description: "Aplikasi operasional pemantauan kinerja indikator RPJMD Kabupaten Boyolali.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="font-body bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
