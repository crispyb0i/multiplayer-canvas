import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Multiplayer Canvas",
  description: "A learning-first collaborative diagramming workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <body className="min-h-screen bg-bg font-sans text-ink [background-image:radial-gradient(circle_at_20%_10%,#263754,var(--color-bg)_45%)]">
        {children}
      </body>
    </html>
  );
}
