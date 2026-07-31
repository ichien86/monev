import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIMONEV Eksekutif — Dashboard Pimpinan Kabupaten Boyolali",
  description: "Ringkasan kinerja RPJMD & dukungan anggaran tematik untuk Pimpinan Daerah.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="font-body bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
