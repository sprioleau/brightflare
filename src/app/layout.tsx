import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const manrope = localFont({
  src: "../../public/fonts/manrope-variable.ttf",
  variable: "--font-manrope",
  weight: "400 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "brightflare",
  description: "A childcare center front desk companion app that provides the answers parents need.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${manrope.variable} antialiased font-sans`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
