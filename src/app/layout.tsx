import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "A2OJ — Online Judge khối chuyên Tin",
  description: "Nộp bài, contest và đóng góp đề cho lớp / khối chuyên Tin",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body spellCheck={false} className="min-h-full flex flex-col">
        <Header />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-[var(--line)] py-4 text-center text-xs text-[var(--muted)]">
          A2OJ · Next.js + Prisma · mock/local judge cho quy mô lớp học
        </footer>
      </body>
    </html>
  );
}
