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
  <main
    style={{
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#f5f5f5",
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: "420px",
        backgroundColor: "white",
        padding: "40px",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        textAlign: "center",
      }}
    >
      <img
        src="/image_1.png"
        alt="Keelworks"
        style={{
          width: "120px",
          marginBottom: "24px",
        }}
      />

      <h1 style={{ marginBottom: "12px" }}>
        Keelworks Bridge
      </h1>

      <p
        style={{
          color: "#666",
          marginBottom: "32px",
        }}
      >
        Connect projects with volunteer developers.
      </p>

      <button
        onClick={handleLogin}
        disabled={loading}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "8px",
          border: "none",
          cursor: "pointer",
          fontSize: "16px",
        }}
      >
        {loading
          ? "Redirecting..."
          : "Continue with Google"}
      </button>
    </div>
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