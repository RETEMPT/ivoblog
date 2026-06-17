"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";

export default function PageTransition({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? { opacity: 0 } : { y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ease: [0.22, 1, 0.36, 1], duration: reduceMotion ? 0.01 : 0.32 }}
    >
      {children}
    </motion.div>
  );
}
