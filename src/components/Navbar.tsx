"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Navbar() {
  const [hasSession, setHasSession] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(savedTheme === "dark" || (savedTheme !== "light" && prefersDark));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  function toggleTheme() {
    const nextIsDark = !isDark;
    setIsDark(nextIsDark);
    window.localStorage.setItem("theme", nextIsDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", nextIsDark);
  }

  return (
    <nav className="site-navbar" aria-label="Main navigation">
      <Link href="/" aria-label="Keelworks Bridge home">
        <Image className="site-logo" src="/image_1.png" alt="Keelworks" width={120} height={40} priority />
      </Link>
      <div className="site-nav-links">
        <Link href="/developers">Developers</Link>
        <Link href="/queue">Request queue</Link>
        {!hasSession && <Link href="/login">Login</Link>}
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
          title={`Switch to ${isDark ? "light" : "dark"} theme`}
        >
          <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
          <span>{isDark ? "Light" : "Dark"}</span>
        </button>
      </div>
    </nav>
  );
}
