import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans, Atkinson_Hyperlegible } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["SOFT", "opsz"] });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-atkinson" });

export const metadata: Metadata = {
  title: "Kindred — Different generations. Shared stories. Lasting connections.",
  description: "Kindred pairs older adults with English learners for real conversations, lasting friendships, personalized practice and a shared Memory Book.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jakarta.variable} ${atkinson.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
