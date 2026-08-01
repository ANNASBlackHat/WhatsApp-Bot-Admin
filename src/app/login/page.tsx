"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      setIsSubmitting(true);
      await signIn(email, password);
    } catch (err: unknown) {
      console.error("Login error:", err);
      const firebaseError = err as { code?: string; message?: string };
      
      if (firebaseError.code === "auth/invalid-credential" || firebaseError.code === "auth/user-not-found" || firebaseError.code === "auth/wrong-password") {
        setError("Invalid email or password. Please try again.");
      } else if (firebaseError.code === "auth/too-many-requests") {
        setError("Too many failed login attempts. Please wait a moment and try again.");
      } else if (firebaseError.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError(firebaseError.message || "Failed to sign in. Please check your credentials.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-border-custom bg-surface p-6 shadow-xs sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-medium text-text-primary">WhatsApp Bot Admin</h1>
          <p className="mt-1 text-xs text-text-secondary">
            Sign in to access your bot controls
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded border border-border-custom bg-canvas p-3 text-xs text-accent-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-xs font-medium text-text-primary"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-border-custom bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-text-primary focus:outline-none focus:ring-1 focus:ring-text-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-xs font-medium text-text-primary"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-border-custom bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-text-primary focus:outline-none focus:ring-1 focus:ring-text-primary"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full rounded bg-text-primary px-4 py-2 text-sm font-medium text-surface transition-colors hover:bg-text-primary/90 focus:outline-none focus:ring-2 focus:ring-text-primary focus:ring-offset-2 disabled:opacity-50"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}

