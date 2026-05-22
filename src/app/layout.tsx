import type { Metadata } from "next";
import { QueryProvider } from "@/app/query-provider";
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
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
