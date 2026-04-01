import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cronan & Locke Systems Admin",
  description: "Operations dashboard for the Cronan & Locke Systems banking platform."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
