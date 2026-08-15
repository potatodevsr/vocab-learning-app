import type { MetadataRoute } from "next";

/**
 * A daily-habit learning app that cannot be installed to a home screen is throwing away
 * its best retention surface. Thai is the primary audience (AGENTS.md rule 3), so the
 * installed shortcut speaks Thai and opens the Thai locale.
 *
 * `display: standalone` is what removes the browser chrome; without it an installed
 * shortcut is just a bookmark.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vocab Learning — คำศัพท์ Oxford 3000",
    short_name: "Vocab Learning",
    description:
      "เรียนคำศัพท์ภาษาอังกฤษจากชุด Oxford 3000 พร้อมความหมายภาษาไทยและคำอ่าน ฝึกวันละบทสั้น ๆ",
    lang: "th",
    start_url: "/th",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f5ef",
    theme_color: "#f7f5ef",
    categories: ["education", "books"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
