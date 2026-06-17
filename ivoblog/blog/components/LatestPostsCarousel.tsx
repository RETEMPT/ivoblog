// components/LatestPostsCarousel.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type PostCard = {
  slug: string;
  title: string;
  description?: string;
  cover?: string;
  formattedDate?: string;
};

export default function LatestPostsCarousel({ posts }: { posts: PostCard[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (posts.length <= 1) return;

    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setCurrentIndex((prev) => (prev + 1) % posts.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [posts.length]);

  if (!posts || posts.length === 0) return null;

  const currentPost = posts[currentIndex] ?? posts[0];
  const href = currentPost.slug === "none" ? "#" : `/posts/${currentPost.slug}`;

  return (
    <div className="uupm-card uupm-anime-frame uupm-lift uupm-sheen md:col-span-4 rounded-3xl overflow-hidden relative group min-h-[420px] h-full flex flex-col">
      <div className="uupm-speed-lines z-[1]" />

      <Link href={href} className="absolute inset-0 z-20" aria-label={`Read ${currentPost.title}`} />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentPost.slug || currentIndex}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.015 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.998 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 z-0"
        >
          {currentPost.cover && (
            <Image
              src={currentPost.cover}
              alt={currentPost.title}
              fill
              priority={currentIndex === 0}
              sizes="(max-width: 1024px) 100vw, 33vw"
              className="w-full h-full object-cover opacity-95 transition-transform duration-[400ms] ease-out group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
          <div className="uupm-screen-dots" />
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 flex flex-col justify-end p-6 w-full mt-auto h-full pointer-events-none">
        <div className="flex items-center gap-2 mb-3">
          <span className="uupm-sticker px-3 py-1 rounded-full text-[10px] font-black uppercase shadow-lg">
            <span className="text-blue-700 dark:text-blue-200">Latest Insight</span>
          </span>
          {currentPost.formattedDate && (
            <span className="px-2 py-1 bg-black/40 backdrop-blur-md border border-white/20 rounded-full text-[10px] text-white/90 font-mono tracking-wider">
              <i className="ri-time-line mr-1" />
              {currentPost.formattedDate}
            </span>
          )}
        </div>
        <h2 className="uupm-anime-glow text-2xl font-black text-white mb-2 group-hover:-translate-y-1 transition-transform duration-300 drop-shadow-md">
          {currentPost.title}
        </h2>
        <p className="text-sm text-gray-300 line-clamp-3 drop-shadow-sm mb-6">{currentPost.description}</p>
      </div>

      {posts.length > 1 && (
        <div className="absolute bottom-4 right-6 z-30 flex gap-2">
          {posts.map((_, i) => (
            <button
              type="button"
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(i);
              }}
              className={`h-2 rounded-full transition-all duration-500 ${i === currentIndex ? "w-7 bg-blue-400" : "w-2 bg-white/40 hover:bg-white/80"}`}
              aria-label={`Show post ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
