import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter — accessibility-first UI face for the admin surface; pairs with the
// Poppins used on the printed cards. Loaded as a CSS var consumed by @theme.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nxt Schools ID Card Software",
  description: "Manage student & staff records and generate school ID cards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
