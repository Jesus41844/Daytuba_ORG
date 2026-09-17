import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Daytuba Tasks",
    short_name: "Daytuba",
    description:
      "Organiza tu semana universitaria — tareas, proyectos y calendario en un solo lugar",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f5f6fa",
    theme_color: "#4f46b8",
    lang: "es",
    orientation: "portrait-primary",
    categories: ["productivity", "education"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
