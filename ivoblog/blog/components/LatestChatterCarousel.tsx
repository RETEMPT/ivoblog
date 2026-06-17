// components/LatestChatterCarousel.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type ChatterCard = {
  slug: string;
  title: string;
  description?: string;
  cover?: string;
  formattedDate?: string;
};

export default function LatestChatterCarousel({ chatters }: { chatters: ChatterCard[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (chatters.length <= 1) return;

    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setCurrentIndex((prev) => (prev + 1) % chatters.length);
    }, 7000);

    return () => window.clearInterval(timer);
  }, [chatters.length]);

  if (!chatters || chatters.length === 0) return null;

  const currentChatter = chatters[currentIndex] ?? chatters[0];
  const href = currentChatter.slug === "none" ? "/chatter" : `/chatter/${currentChatter.slug}`;

  return (
    <div className="uupm-card uupm-anime-frame uupm-lift uupm-sheen w-full h-full rounded-3xl overflow-hidden relative group min-h-[220px] flex flex-col">
      <div className="uupm-speed-lines z-[1]" />
      <Link href={href} className="absolute inset-0 z-20" aria-label={`Open chatter ${currentChatter.title}`} />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentChatter.slug || currentIndex}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.01 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.36, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 z-0"
        >
          {currentChatter.cover && (
            <Image
              src={currentChatter.cover}
              alt={currentChatter.title}
              fill
              priority={currentIndex === 0}
              sizes="(max-width: 1024px) 100vw, 66vw"
              className="w-full h-full object-cover opacity-85 dark:opacity-70 transition-transform duration-[400ms] ease-out group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-black/10" />
          <div className="uupm-screen-dots" />
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 flex flex-col justify-center p-6 md:p-8 h-full pointer-events-none w-full md:w-[85%]">
        <div className="flex items-end gap-2 mb-2">
          <span className="uupm-sticker px-2 py-1 rounded-md text-[10px] font-black uppercase">
            <span className="text-blue-700 dark:text-blue-200">Records</span>
          </span>
          {currentChatter.formattedDate && (
            <span className="text-[11px] font-mono text-slate-300 drop-shadow-md">{currentChatter.formattedDate}</span>
          )}
        </div>

        <h3 className="uupm-anime-glow text-2xl font-black text-white mb-3 group-hover:text-blue-200 transition-colors line-clamp-1 drop-shadow-md">
          {currentChatter.title}
        </h3>
        <p className="text-sm text-slate-300 font-medium leading-relaxed drop-shadow-md line-clamp-2">
          {currentChatter.description}
        </p>
      </div>

      {chatters.length > 1 && (
        <div className="absolute bottom-5 right-6 z-30 flex gap-2">
          {chatters.map((_, i) => (
            <button
              type="button"
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(i);
              }}
              className={`h-2 rounded-full transition-all duration-500 shadow-sm ${i === currentIndex ? "w-7 bg-blue-400" : "w-2 bg-white/40 hover:bg-white/80"}`}
              aria-label={`Show chatter ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
