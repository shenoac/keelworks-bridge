"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import "./login.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
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
    if (!email.endsWith("@keelworks.org")) {
      alert("Use company email");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/login?redirect=/queue`,
      },
    });

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      alert(
        "Check your email for the login link. After clicking, you'll be redirected automatically."
      );
      setEmail("");
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
        <input
          type="email"
          placeholder="name@keelworks.org"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button onClick={handleLogin} disabled={loading}>
          {loading ? "Sending Link..." : "Login with Email"}
        </button>
      </div>
    </div>
  );
}