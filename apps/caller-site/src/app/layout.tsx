import type { Metadata } from "next";
import { Baloo_2, Hind, Yatra_One, Besley, Manrope } from "next/font/google";
import Navbar from "@/components/Navbar";
import "@/styles/globals.css";
import "@/styles/haqdaar.css";
import "@/styles/editorial.css";
import "@/styles/call.css";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { CallProvider } from "@/features/call/CallProvider";

const baloo = Baloo_2({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-baloo",
});

const hind = Hind({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hind",
});

const yatraOne = Yatra_One({
  subsets: ["latin", "devanagari"],
  weight: "400",
  variable: "--font-yatra-one",
});

const besley = Besley({
  subsets: ["latin"],
  variable: "--font-besley",
});

// The page typeface of the editorial pages (Devanagari falls back to Noto Sans Devanagari).
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Haqdaar.ai: know every scheme you're entitled to",
  description:
    "Speak or type your situation once. Haqdaar.ai matches you against 4,700+ Indian central and state welfare schemes with fixed, explainable rules.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/css/navbar.css" />
      </head>
      <body className={`${baloo.variable} ${hind.variable} ${yatraOne.variable} ${besley.variable} ${manrope.variable}`}>
        <LanguageProvider>
          <CallProvider>
            <Navbar />
            {children}
          </CallProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
