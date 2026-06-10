import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Sistem Karyawan Burjolevelup",
  description: "Aplikasi operasional karyawan premium Burjolevelup, absensi dengan kamera selfie & lokasi GPS, pelacakan jobdesk, catatan bersama, dan log finansial utang.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Burjolevelup",
  },
};

export default function RootLayout({
  children,
  headerBg,
}: Readonly<{
  children: React.ReactNode;
  headerBg?: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${outfit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-black text-zinc-150 selection:bg-zinc-800 selection:text-white">
        {children}
        <PWAInstallPrompt />
        <Toaster theme="dark" closeButton />
      </body>
    </html>
  );
}
