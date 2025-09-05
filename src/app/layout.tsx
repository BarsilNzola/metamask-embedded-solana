import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "MetaMask Embedded Solana dApp",
  description: "Hackathon demo: Web2 → Web3 identity with Solana + Web3Auth",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="gradient-bg min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}