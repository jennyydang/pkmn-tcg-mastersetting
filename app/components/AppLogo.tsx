import Image from "next/image";

// The pocketi app icon (public/pocketi-icon.svg, from resources/icon.svg).
// Decorative: it always sits next to the app name, so it has no alt text.
export default function AppLogo({ className = "w-7 h-7" }: { className?: string }) {
  return <Image src="/pocketi-icon.svg" alt="" width={64} height={64} className={`${className} shrink-0`} unoptimized priority />;
}
