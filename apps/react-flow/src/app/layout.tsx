import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@xyflow/react/dist/style.css";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "CDD Context Graph",
  description: "React Flow graph visualization for CDD contexts",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
