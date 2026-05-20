"use client";

import { useTheme } from "@/lib/theme";
import { MoonIcon, SunIcon } from "./Icons";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {theme === "light" ? (
        <MoonIcon className="w-5 h-5 text-gray-700 dark:text-gray-200" aria-hidden="true" />
      ) : (
        <SunIcon className="w-5 h-5 text-yellow-500" aria-hidden="true" />
      )}
    </button>
  );
}
