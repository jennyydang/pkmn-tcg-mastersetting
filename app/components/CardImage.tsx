"use client";

import Image from "next/image";
import { useImageSrc } from "@/lib/imageCache";

interface Props {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  onError?: () => void;
}

// A card scan that falls back to the copy saved by "Save for offline" when the
// device is offline (lib/imageCache.ts).
export default function CardImage({ src, alt, ...rest }: Props) {
  const resolved = useImageSrc(src);
  return <Image src={resolved} alt={alt} {...rest} unoptimized />;
}
