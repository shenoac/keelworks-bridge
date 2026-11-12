"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type CopyState = "idle" | "copied" | "error";

interface CopyEmailButtonProps {
  email?: string | null;
  label?: string;
}

export default function CopyEmailButton({ email, label }: CopyEmailButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const trimmedEmail = email?.trim();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleClick = useCallback(async () => {
    if (!trimmedEmail) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API not available");
      }
      await navigator.clipboard.writeText(trimmedEmail);
      if (isMountedRef.current) {
        setState("copied");
      }
    } catch {
      if (isMountedRef.current) {
        setState("error");
      }
    }

    timerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setState("idle");
      }
    }, 2000);
  }, [trimmedEmail]);

  if (!trimmedEmail) {
    return null;
  }

  const ariaLabel = label ? `Copy email for ${label}` : `Copy email ${trimmedEmail}`;

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        aria-label={ariaLabel}
        className="inline-flex items-center justify-center rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 dark:focus:ring-slate-500"
      >
        {state === "idle" && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
        {state === "copied" && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="text-green-600 dark:text-green-400"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {state === "error" && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="text-red-600 dark:text-red-400"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </button>
      <span
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {state === "copied" && "Copied"}
        {state === "error" && "Copy failed"}
      </span>
    </span>
  );
}
