"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { tapFeedback } from "@/lib/haptics";
import { CardsIcon, HomeIcon, StarIcon, TrendingUpIcon, UserIcon } from "./Icons";

// Phone tab bar (hidden from md up, where the header links are shown instead).
// Each tab also owns the pages reached from it, so they stay highlighted there.
const TABS = [
  { href: "/",           label: "Home",       Icon: HomeIcon,       match: ["/", "/sets", "/pokemon", "/artist", "/custom"] },
  { href: "/collection", label: "Collection", Icon: CardsIcon,      match: ["/collection"] },
  { href: "/wants",      label: "Wants",      Icon: StarIcon,       match: ["/wants"] },
  { href: "/portfolio",  label: "Portfolio",  Icon: TrendingUpIcon, match: ["/portfolio"] },
  { href: "/account",    label: "Account",    Icon: UserIcon,       match: ["/account", "/admin", "/feedback", "/privacy", "/support"] },
] as const;

export default function BottomNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  if (!user) return null;

  const active = TABS.find((t) => t.match.some((m) => (m === "/" ? pathname === "/" : pathname === m || pathname.startsWith(`${m}/`))));

  return (
    <nav
      aria-label="Main"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-t border-gray-200 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {TABS.map(({ href, label, Icon }) => {
          const current = active?.href === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                onClick={() => { if (!current) tapFeedback(); }}
                className={`flex flex-col items-center justify-center gap-0.5 h-14 text-[10px] font-medium transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                  current ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <span className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors duration-200 ${current ? "bg-blue-100 dark:bg-blue-900/50" : ""}`}>
                  <Icon className={`w-5 h-5 transition-transform duration-200 ${current ? "scale-110" : ""}`} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
