"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function LoginContent() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const redirectTo = searchParams.get("redirect") || "/queue";

      if (session) {
        if (searchParams.has("redirect")) {
          router.push(redirectTo);
        }
      }

      setSessionChecked(true);
    };

    checkSession();
  }, [router, searchParams]);

    const handleLogin = async () => {
      setLoading(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${location.origin}/queue`,
    },
  });

  if (error) {
    setLoading(false);
    alert(error.message);
  }
};

  if (!sessionChecked) return null;

  return (
    <div className="page-center">
      <div className="navbar">
        <img src="/image_1.png" alt="Logo" className="logo-top" />
        <div className="nav-right">
          <a href="https://sites.google.com/keelworks.org/keelworks-foundation/home">Home</a>
          <a href="https://sites.google.com/keelworks.org/keelworks-foundation/about-us">About</a>
          <a href="https://sites.google.com/keelworks.org/keelworks-foundation/portal">Portal</a>
          <a href="https://sites.google.com/keelworks.org/keelworks-foundation/resources">Resources</a>
        </div>
      </div>

      <div className="login-container">
        <h1>Login</h1>
        <button onClick={handleLogin} disabled={loading}>
          {loading ? "Redirecting..." : "Continue with Google"}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}