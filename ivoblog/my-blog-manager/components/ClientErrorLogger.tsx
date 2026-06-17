"use client";

import { useEffect } from "react";
import { logClientEvent } from "../lib/clientLogger";

export default function ClientErrorLogger() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      logClientEvent("error", "window.error", event.message || "Unhandled runtime error", {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      logClientEvent("error", "unhandledrejection", "Unhandled promise rejection", event.reason);
    };

    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args: unknown[]) => {
      logClientEvent("error", "console.error", args.map(String).join(" "));
      originalError(...args);
    };

    console.warn = (...args: unknown[]) => {
      logClientEvent("warning", "console.warn", args.map(String).join(" "));
      originalWarn(...args);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  return null;
}
