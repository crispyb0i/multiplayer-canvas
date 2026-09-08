import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Multiplayer Canvas",
  description: "A learning-first collaborative diagramming workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
