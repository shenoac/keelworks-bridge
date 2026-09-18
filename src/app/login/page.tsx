"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

function getRedirectPath(searchParams: URLSearchParams) {
  const redirectParam = searchParams.get("redirect");

  return redirectParam?.startsWith("/") && !redirectParam.startsWith("//")
    ? redirectParam
    : "/queue";
}

async function getPostLoginPath(redirectPath: string) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) return redirectPath;

  const response = await fetch("/api/developers", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.ok && (await response.json()).isAdmin === true) return "/admin";
  return redirectPath;
}

function LoginContent() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) setError(sessionError.message);

      const redirectTo = getRedirectPath(searchParams);

      if (session) {
        router.replace(await getPostLoginPath(redirectTo));
      }

      setSessionChecked(true);
    };

    checkSession();
  }, [router, searchParams]);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    const redirectTo = getRedirectPath(searchParams);
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/login?redirect=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
    }
  };

  if (!sessionChecked) return null;

  return (
    <main className="page-center">
      <section className="login-container" aria-labelledby="login-title">
        <div className="brand-mark">
          <Image src="/image_1.png" alt="" width={64} height={64} priority />
        </div>
        <p className="eyebrow">Internal workspace</p>
        <h1 id="login-title">Welcome to Keelworks Bridge</h1>
        <p className="login-copy">
          Connect meaningful projects with the people who can move them forward.
        </p>

        {error && (
          <div className="login-alert" role="alert">
            <strong>Unable to sign you in</strong>
            <span>{error}</span>
          </div>
        )}

        <button className="google-btn" onClick={handleLogin} disabled={loading}>
          <span className="google-icon" aria-hidden="true">G</span>
          <span>{loading ? "Opening Google..." : "Continue with Google"}</span>
        </button>
        <p className="access-note">Use your Keelworks Google account to continue.</p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}