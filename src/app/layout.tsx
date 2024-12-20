import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Nav } from '@/components/nav'
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "目录查看器",
  description: "在线目录结构展示工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body className={inter.className}>
        <Nav />
        <main className="min-h-[calc(100vh-4rem)] bg-background">
          {children}
        </main>
      </body>
    </html>
  );
}
