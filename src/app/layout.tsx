import type { Metadata } from "next";
import { QueryProvider } from "@/app/query-provider";
import { ThemeProvider } from "@/app/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "OhmSweetOhm",
  description: "Home electronics workshop management."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme class before first paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('oso:theme')||'auto';if(t==='auto'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.add('theme-'+t);})();`
          }}
        />
      </head>
      <body>
        <QueryProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
