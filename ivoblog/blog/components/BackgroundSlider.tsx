"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { siteConfig } from "../siteConfig";

const LOCAL_FALLBACKS = [
  "/uploads/images/_20251225232527_213_2-0d4cd615c3.jpg",
  "/uploads/images/mmexport1766655840334-e8d92d0c35.jpg",
  "/uploads/images/Image_1766505805627-30e87d0c37.jpg",
];

const BACKGROUND_IMAGES = Array.from(
  new Set(
    [
      ...(Array.isArray(siteConfig.bgImages) ? siteConfig.bgImages : []),
      siteConfig.photoWallImage,
      siteConfig.defaultPostCover,
      ...LOCAL_FALLBACKS,
    ].filter((image): image is string => typeof image === "string" && image.trim().length > 0),
  ),
);

export default function BackgroundSlider() {
  const effectsConfig = siteConfig.effectsConfig || {};
  const canAnimate = effectsConfig.performanceMode !== "performance";
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const visibleImages = useMemo(
    () => BACKGROUND_IMAGES.filter((image) => !failed.has(image)),
    [failed],
  );

  useEffect(() => {
    if (index >= visibleImages.length) setIndex(0);
  }, [index, visibleImages.length]);

  useEffect(() => {
    if (!canAnimate || visibleImages.length <= 1) return;

    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setIndex((prev) => (prev + 1) % visibleImages.length);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [canAnimate, visibleImages.length]);

  const markFailed = useCallback((image: string) => {
    setFailed((prev) => {
      if (prev.has(image)) return prev;
      const next = new Set(prev);
      next.add(image);
      return next;
    });
  }, []);

  return (
    <div className="absolute inset-0 z-[-10] overflow-hidden bg-gradient-to-br from-sky-100 via-fuchsia-100 to-emerald-100 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900">
      {visibleImages.map((image, imageIndex) => (
        <img
          key={image}
          src={image}
          alt=""
          aria-hidden="true"
          decoding="async"
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => markFailed(image)}
          className={`absolute inset-0 h-full w-full object-cover ${canAnimate ? "transition-opacity duration-[1600ms] ease-out transform-gpu" : ""}`}
          style={{
            opacity: imageIndex === index ? 1 : 0,
            visibility: Math.abs(imageIndex - index) <= 1 || (imageIndex === visibleImages.length - 1 && index === 0) ? "visible" : "hidden",
            willChange: canAnimate ? "opacity" : "auto",
          }}
        />
      ))}
    </div>
  );
}
