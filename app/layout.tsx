import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import HeaderActions from "./components/HeaderActions";
import { PokeBallIcon } from "./components/Icons";
import Link from "next/link";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pokémon TCG Master Set Tracker",
  description: "Track your progress toward mastering every Pokémon TCG set",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.className} bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-screen`}>
        <ThemeProvider>
          <AuthProvider>
            <StoreProvider>
              <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
                  <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100 hover:opacity-80 transition-opacity">
                    <PokeBallIcon className="w-7 h-7 text-red-500" />
                    <span className="hidden sm:block text-sm">Master Set Tracker</span>
                  </Link>
                  <HeaderActions />
                </div>
              </header>
              <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {children}
              </main>
            </StoreProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
