import type { Metadata } from "next";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "DRP | Defesa Civil de Goiana — Mapa de famílias",
  description:
    "Gestão em campo da Defesa Civil de Goiana: cadastro de famílias, mapa social e contexto ambiental.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
