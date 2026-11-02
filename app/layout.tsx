import type { Metadata } from "next";
import "./workbench.css";
import "./map.css";

export const metadata: Metadata = {
  title: "文物资源评估及规划响应平台 · HVRP",
  description: "HVRP：文物资源档案、敏感性评价、证据知识库及规划响应研究。",
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
