import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";

import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Daytuba Tasks",
  description: "Organiza tu semana universitaria — tareas, proyectos y calendario en un solo lugar",
  applicationName: "Daytuba Tasks",
  appleWebApp: {
    capable: true,
    title: "Daytuba",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#161618" },
  ],
};

const THEME_SCRIPT = `
(function(){try{var t=localStorage.getItem('utp-theme');if(t==='dark'||t==='light'){document.documentElement.classList.add(t)}else if(window.matchMedia('(prefers-color-scheme:dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}})()
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${plusJakarta.variable} ${spaceGrotesk.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <script
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
