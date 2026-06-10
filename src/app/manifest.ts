import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sistem Karyawan Burjolevelup",
    short_name: "Burjolevelup",
    description: "Aplikasi operasional karyawan premium Burjolevelup, absensi dengan kamera selfie & lokasi GPS, pelacakan jobdesk, catatan bersama, dan log finansial utang.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
