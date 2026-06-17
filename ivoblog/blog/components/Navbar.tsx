"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  AnimatePresence,
  motion,
  PanInfo,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { Menu, X } from "lucide-react";
import { siteConfig } from "../siteConfig";

const navLinks = [
  { name: "首页", href: "/" },
  { name: "项目", href: "/projects" },
  { name: "归档", href: "/timeline" },
  { name: "照片墙", href: "/photowall" },
  { name: "音乐", href: "/music" },
  { name: "灵境", href: "/tree" },
  { name: "说说", href: "/moments" },
  { name: "杂谈", href: "/chatter" },
  { name: "友链", href: "/friends" },
  { name: "关于", href: "/about" },
];

export default function Navbar() {
  const [showNav, setShowNav] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [constraints, setConstraints] = useState({ top: 0, bottom: 0 });
  const pathname = usePathname();
  const lastScrollYRef = useRef(0);
  const wheelRef = useRef<HTMLDivElement>(null);

  const rawRotation = useMotionValue(0);
  const smoothRotation = useSpring(rawRotation, { stiffness: 200, damping: 25 });
  const inverseRotation = useTransform(smoothRotation, (r) => -r);
  const dragY = useMotionValue(0);

  useEffect(() => {
    const updateConstraints = () => {
      const vh = window.innerHeight;
      setConstraints({
        top: -(vh / 2) + 80,
        bottom: vh / 2 - 80,
      });
    };

    updateConstraints();
    window.addEventListener("resize", updateConstraints, { passive: true });
    return () => window.removeEventListener("resize", updateConstraints);
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) rawRotation.set(0);
  }, [isMobileMenuOpen, rawRotation]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setShowNav(!(currentScrollY > lastScrollYRef.current && currentScrollY > 80));
      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handlePan = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!wheelRef.current) return;

    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const currX = info.point.x;
    const currY = info.point.y;
    const prevX = currX - info.delta.x;
    const prevY = currY - info.delta.y;
    const prevAngle = Math.atan2(prevY - centerY, prevX - centerX);
    const currAngle = Math.atan2(currY - centerY, currX - centerX);
    let deltaAngle = (currAngle - prevAngle) * (180 / Math.PI);

    if (deltaAngle > 180) deltaAngle -= 360;
    if (deltaAngle < -180) deltaAngle += 360;
    rawRotation.set(rawRotation.get() + deltaAngle);
  };

  return (
    <>
      <header
        className={`hidden md:block fixed inset-x-0 top-0 z-50 w-full border-b backdrop-blur-xl transition-all duration-500 uupm-nav-glass ${
          showNav ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto flex h-16 w-[90%] max-w-6xl items-center justify-between px-4 sm:px-[30px]">
          <Link
            href="/"
            className="text-xl font-black text-slate-900 transition-colors duration-300 hover:text-pink-600 dark:text-white dark:hover:text-sky-300"
          >
            {siteConfig.navTitle || siteConfig.authorName}
            {siteConfig.navSuffix && (
              <span className="mx-1 text-pink-500 dark:text-sky-300">{siteConfig.navSuffix}</span>
            )}
            <span className={siteConfig.navSuffix ? "" : "ml-1 text-pink-500 dark:text-sky-300"}>
              {siteConfig.navAfter || "Blog"}
            </span>
          </Link>

          <nav className="flex gap-6 text-sm font-bold">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname === `${link.href}/`;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative py-1 transition-colors duration-300 ${
                    isActive
                      ? "text-pink-600 dark:text-sky-300"
                      : "text-slate-700 hover:text-pink-600 dark:text-slate-200 dark:hover:text-sky-300"
                  }`}
                >
                  {link.name}
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-pink-500 dark:bg-sky-300" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="md:hidden">
        <motion.button
          drag="y"
          dragConstraints={constraints}
          dragElastic={0.1}
          dragMomentum={false}
          style={{ y: dragY }}
          onClick={() => {
            if (Math.abs(dragY.getVelocity()) < 10) setIsMobileMenuOpen(true);
          }}
          aria-label="打开导航"
          className={`fixed right-0 top-1/2 z-[60] flex h-28 w-12 -translate-y-1/2 touch-none items-center justify-center rounded-l-full border-y border-l border-white/30 bg-pink-500/85 shadow-[-5px_0_24px_rgba(236,72,153,0.34)] backdrop-blur-xl transition-all duration-500 dark:bg-sky-500/80 ${
            isMobileMenuOpen ? "translate-x-full opacity-0 pointer-events-none" : "translate-x-0 opacity-100"
          }`}
        >
          <Menu className="mr-2 h-5 w-5 text-white" />
        </motion.button>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 z-[65] bg-slate-900/60 backdrop-blur-md"
              />

              <motion.div
                initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
                transition={{ type: "spring", damping: 20, stiffness: 150 }}
                className="fixed left-1/2 top-1/2 z-[70] h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              >
                <motion.div
                  ref={wheelRef}
                  style={{ rotate: smoothRotation }}
                  onPan={handlePan}
                  className="relative h-full w-full cursor-grab rounded-full border border-white/30 bg-white/40 shadow-[0_0_50px_rgba(0,0,0,0.3)] backdrop-blur-3xl active:cursor-grabbing pointer-events-auto dark:border-slate-500/50 dark:bg-slate-800/50"
                >
                  <div className="absolute left-1/2 top-1/2 z-10 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-slate-300 bg-slate-100 shadow-inner dark:border-slate-500 dark:bg-slate-700">
                    <button
                      type="button"
                      aria-label="关闭导航"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-500 text-white shadow-lg transition-all duration-300 hover:rotate-90 hover:bg-rose-500 active:scale-95 dark:bg-sky-500 dark:hover:bg-cyan-500"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {navLinks.map((link, index) => {
                    const isActive = pathname === link.href || pathname === `${link.href}/`;
                    const angle = index * (360 / navLinks.length);

                    return (
                      <div
                        key={link.href}
                        className="absolute left-1/2 top-1/2 -ml-7 -mt-7 flex h-14 w-14 items-center justify-center"
                        style={{
                          transform: `rotate(${angle}deg) translateY(-115px) rotate(${-angle}deg)`,
                        }}
                      >
                        <motion.div style={{ rotate: inverseRotation }} className="h-full w-full">
                          <Link
                            href={link.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`flex h-full w-full items-center justify-center rounded-full border transition-all duration-300 ${
                              isActive
                                ? "scale-110 border-pink-400 bg-pink-500 text-white shadow-[0_0_18px_rgba(236,72,153,0.62)] dark:border-sky-300 dark:bg-sky-500"
                                : "border-white/50 bg-white/90 text-slate-800 shadow-md hover:scale-110 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                            }`}
                          >
                            <span className="text-[11px] font-black">{link.name}</span>
                          </Link>
                        </motion.div>
                      </div>
                    );
                  })}
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
