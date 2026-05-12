"use client";

import ThemeToggle from "./ThemeToggle";
import { useAuth } from "@/lib/auth";

export default function HeaderActions() {
  const { user, signOut } = useAuth();
  return (
    <div className="flex items-center gap-2">
      {user && (
        <button
          onClick={signOut}
          className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Sign out
        </button>
      )}
      <ThemeToggle />
    </div>
  );
}
