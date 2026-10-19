import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { CardDataProvider } from "@/lib/cardData";
import { ConfirmProvider } from "@/lib/confirm";
import HeaderActions from "./components/HeaderActions";
import BottomNav from "./components/BottomNav";
import SyncErrorBanner from "./components/SyncErrorBanner";
import AnnouncementBanner from "./components/AnnouncementBanner";
import OfflineBanner from "./components/OfflineBanner";
import PullToRefresh from "./components/PullToRefresh";
import HoverTitles from "./components/HoverTitles";
import AppLogo from "./components/AppLogo";
import Link from "next/link";
import { APP_NAME } from "@/lib/appInfo";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Track your progress toward mastering every Pokémon TCG set",
};

// "cover" lets the app draw under the iPhone notch and home indicator; the header
// and main area pad themselves with the safe-area insets instead.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.className} bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-screen`}>
        <ThemeProvider>
          <ConfirmProvider>
          <AuthProvider>
            <StoreProvider>
            <CardDataProvider>
              <header className="sticky top-0 z-40 pt-[env(safe-area-inset-top)] bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
                  <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100 hover:opacity-80 transition-opacity">
                    <AppLogo className="w-7 h-7" />
                    <span className="text-sm">{APP_NAME}</span>
                  </Link>
                  <HeaderActions />
                </div>
              </header>
              <OfflineBanner />
              <AnnouncementBanner />
              <SyncErrorBanner />
              <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-[calc(2rem+env(safe-area-inset-bottom))]">
                <PullToRefresh>{children}</PullToRefresh>
              </main>
              <BottomNav />
              <HoverTitles />
            </CardDataProvider>
            </StoreProvider>
          </AuthProvider>
          </ConfirmProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
