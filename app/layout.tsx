import type { Metadata } from "next";
import "./workbench.css";
import "./map.css";

export const metadata: Metadata = {
  title: "HERISK · 文垣智评",
  description: "HERISK：文物资源档案、敏感性评价、证据知识库及规划响应研究。",
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
