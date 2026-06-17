"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const IDLE_LINES = [
  "Nya~ page is smooth today.",
  "I am guarding the blog.",
  "Tiny break, then more code.",
  "The network feels quiet.",
  "Need a thought? Tap chat.",
];

export default function CyberCat() {
  const [isPetted, setIsPetted] = useState(false);
  const [speech, setSpeech] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const reduceMotion = useReducedMotion();

  const chatTimeoutRef = useRef<number | null>(null);
  const petTimeoutRef = useRef<number | null>(null);
  const stateRef = useRef({ speech, showInput, isThinking });

  useEffect(() => {
    stateRef.current = { speech, showInput, isThinking };
  }, [speech, showInput, isThinking]);

  const clearChatTimeout = useCallback(() => {
    if (chatTimeoutRef.current) {
      window.clearTimeout(chatTimeoutRef.current);
      chatTimeoutRef.current = null;
    }
  }, []);

  const speak = useCallback((text: string, duration = 5200) => {
    setSpeech(text);
    clearChatTimeout();
    chatTimeoutRef.current = window.setTimeout(() => setSpeech(null), duration);
  }, [clearChatTimeout]);

  const requestChat = async (message: string, fallback: string) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      return String(data.reply || data.error || fallback);
    } catch {
      return fallback;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const handlePetCat = () => {
    if (petTimeoutRef.current) window.clearTimeout(petTimeoutRef.current);
    setIsPetted(true);
    speak("Nya~ that feels nice.", 1600);
    petTimeoutRef.current = window.setTimeout(() => setIsPetted(false), 900);
  };

  const handleFeed = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isThinking) return;

    setShowInput(false);
    setIsThinking(true);
    speak("Crunching the snack and thinking...", 6000);

    const reply = await requestChat(
      "I just fed you a snack. Give me one short playful line.",
      "Network is resting. I will keep watch quietly."
    );
    speak(reply, 8000);
    setIsThinking(false);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isThinking) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setShowInput(false);
    setIsThinking(true);
    speak("Thinking...", 9000);

    const reply = await requestChat(userMessage, "The chat line is busy right now.");
    speak(reply, 8000);
    setIsThinking(false);
  };

  useEffect(() => {
    const randomTalkInterval = window.setInterval(() => {
      if (document.hidden) return;

      const current = stateRef.current;
      if (!current.speech && !current.showInput && !current.isThinking && Math.random() > 0.86) {
        const randomMsg = IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)];
        speak(randomMsg, 3800);
      }
    }, 24000);

    return () => {
      window.clearInterval(randomTalkInterval);
      clearChatTimeout();
      if (petTimeoutRef.current) window.clearTimeout(petTimeoutRef.current);
    };
  }, [clearChatTimeout, speak]);

  return (
    <motion.div
      drag={!reduceMotion}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.22}
      dragMomentum={false}
      whileHover={reduceMotion ? undefined : { scale: 1.03 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      whileDrag={reduceMotion ? undefined : { scale: 1.08, cursor: "grabbing" }}
      transition={{ type: "spring", stiffness: 520, damping: 32, mass: 0.55 }}
      className="fixed bottom-20 right-20 z-[9999] hidden lg:flex flex-col items-center group cursor-grab active:cursor-grabbing"
    >
      <div className="relative w-full flex justify-center mb-6">
        <AnimatePresence>
          {speech && (
            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.92, transition: { duration: 0.16 } }}
              className="absolute bottom-0 bg-white dark:bg-slate-800 text-slate-700 dark:text-gray-200 px-4 py-3 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 text-sm max-w-[240px] break-words text-center leading-relaxed"
              style={{ pointerEvents: "none", transformOrigin: "bottom center" }}
            >
              {speech}
              <div className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-slate-800 border-b border-r border-gray-100 dark:border-slate-700 transform rotate-45" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative">
        <div className="absolute -left-12 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowInput((value) => !value);
            }}
            className="bg-white/90 dark:bg-slate-700/90 p-2.5 rounded-full shadow-md hover:scale-110 active:scale-95 transition-transform border border-gray-100 dark:border-slate-600 text-blue-500 hover:text-blue-600 flex items-center justify-center backdrop-blur-sm"
            title="Chat"
            aria-label="Open chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path
                fillRule="evenodd"
                d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 01-.814 1.686.75.75 0 00.44 1.223zM8.25 10.875a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25zM10.875 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875-1.125a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          <button
            type="button"
            onClick={handleFeed}
            disabled={isThinking}
            className={`bg-white/90 dark:bg-slate-700/90 p-2.5 rounded-full shadow-md hover:scale-110 active:scale-95 transition-transform border border-gray-100 dark:border-slate-600 flex items-center justify-center backdrop-blur-sm ${isThinking ? "opacity-50 cursor-not-allowed" : ""}`}
            title="Snack"
            aria-label="Send snack"
          >
            <span className="text-xl leading-none">+</span>
          </button>
        </div>

        <div className="w-[120px] h-[120px] relative cursor-pointer" onClick={handlePetCat}>
          <style>{`
            .cat-sprite {
              width: 100%;
              height: 100%;
              background-image: url('/siamese-cat.png');
              background-size: 300% 300%;
              background-repeat: no-repeat;
              image-rendering: pixelated;
            }
            .cat-idle { animation: idle-frames 1.05s steps(1) infinite; background-position-y: 0%; }
            .cat-petted { animation: pet-frames 0.5s steps(1) infinite; background-position-y: 50%; }
            .cat-thinking { animation: idle-frames 0.65s steps(1) infinite; background-position-y: 0%; }
            .cat-static { background-position: 0% 0%; }
            @keyframes idle-frames {
              0%, 33.32% { background-position-x: 0%; }
              33.33%, 66.65% { background-position-x: 50%; }
              66.66%, 100% { background-position-x: 100%; }
            }
            @keyframes pet-frames {
              0%, 49.99% { background-position-x: 0%; }
              50%, 100% { background-position-x: 50%; }
            }
          `}</style>
          <div
            className={`cat-sprite drop-shadow-2xl ${
              reduceMotion ? "cat-static" : isPetted ? "cat-petted" : isThinking ? "cat-thinking" : "cat-idle"
            }`}
          />
        </div>
      </div>

      <AnimatePresence>
        {showInput && (
          <motion.form
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -10, scale: reduceMotion ? 1 : 0.92 }}
            onSubmit={handleChatSubmit}
            className="absolute -bottom-14 bg-white dark:bg-slate-800 p-1.5 rounded-full shadow-lg flex items-center border border-gray-200 dark:border-slate-700 w-56 z-20"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Say something..."
              className="bg-transparent border-none outline-none text-sm px-3 py-1 w-full dark:text-white placeholder-gray-400"
              disabled={isThinking}
              autoFocus
            />
            <button
              type="submit"
              disabled={isThinking || !inputValue.trim()}
              className={`rounded-full p-1.5 ml-1 flex items-center justify-center transition-colors ${
                isThinking || !inputValue.trim() ? "bg-gray-300 text-gray-500" : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
              aria-label="Send message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
              </svg>
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
