import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JF Rottorf — Verwaltung",
    short_name: "JF Rottorf",
    description: "Jugendfeuerwehr-Verwaltung & Wettbewerbs-Gruppenplanung",
    start_url: "/",
    display: "standalone",
    background_color: "#161826",
    theme_color: "#161826",
    lang: "de",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
