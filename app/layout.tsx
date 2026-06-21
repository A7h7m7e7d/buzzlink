import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuzzLink — Vibrate Your Friend's Phone",
  description: "Tap to buzz your friend's phone and ask when they'll reach.",
};

export const viewport: Viewport = {
  themeColor: "#0b0420",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
