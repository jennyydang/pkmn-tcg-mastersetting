"use client";

import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "@/lib/auth";

export default function HeaderActions() {
  const { user, signOut } = useAuth();
  return (
    <div className="flex items-center gap-1">
      {user && (
        <>
          <Link href="/collection" className="text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 min-h-[44px] flex items-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            Collection
          </Link>
          <Link href="/portfolio" className="text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 min-h-[44px] flex items-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            Portfolio
          </Link>
          <button onClick={signOut} className="text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 min-h-[44px] flex items-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            Sign out
          </button>
        </>
      )}
      <ThemeToggle />
    </div>
  );
}
