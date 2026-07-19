import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const heading = Poppins({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-heading" });

export const metadata: Metadata = {
  title: "Traço Renovações - CRM & Gestão",
  description: "Plataforma de gestão de obras e orçamentos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <body className={`${body.variable} ${heading.variable} font-body bg-sand-50 text-ink-800`}>
        {children}
      </body>
    </html>
  );
}
