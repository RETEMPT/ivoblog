"use client";

import { useEffect, useState } from "react";

type SafeImageProps = {
  src?: string;
  fallbackSrc: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
};

export default function SafeImage({
  src,
  fallbackSrc,
  alt,
  className,
  loading = "lazy",
}: SafeImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc);

  useEffect(() => {
    setCurrentSrc(src || fallbackSrc);
  }, [src, fallbackSrc]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
      onError={() => {
        if (currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
      }}
    />
  );
}
