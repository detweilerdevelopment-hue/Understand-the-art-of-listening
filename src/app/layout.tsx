import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "GalleryPulse — Listening intelligence",
  description:
    "Transparent measurement and reporting for gallery listening experiences.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
