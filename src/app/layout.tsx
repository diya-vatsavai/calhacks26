import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans, Atkinson_Hyperlegible } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm", display: "swap" });
const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-atkinson", display: "swap" });

export const metadata: Metadata = {
  title: "Kindred — Different generations. Shared stories. Lasting connections.",
  description: "Kindred pairs older adults with English learners for real conversations, lasting friendships, personalized practice and a shared Memory Book.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${dmSans.variable} ${atkinson.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
