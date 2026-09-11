import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Multiplayer Canvas",
  description:
    "A real-time collaborative canvas with live presence, offline sync, and keyboard editing.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <body className="min-h-screen bg-bg font-sans text-ink [background-image:radial-gradient(circle_at_20%_10%,#263754,var(--color-bg)_45%)]">
        {publishableKey ? (
          <ClerkProvider publishableKey={publishableKey}>
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
