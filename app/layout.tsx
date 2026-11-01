import type { Metadata } from "next";
import "./workbench.css";
import "./map.css";

export const metadata: Metadata = {
  title: "上海文物 · 敏感性评价工作台",
  description: "上海不可移动文物基础档案、五维敏感性评价、来源证据与专家复核。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
