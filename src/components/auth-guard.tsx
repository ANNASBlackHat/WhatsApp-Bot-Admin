"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (loading) return;

    if (!user && !isLoginPage) {
      router.replace("/login");
    } else if (user && isLoginPage) {
      router.replace("/");
    }
  }, [user, loading, isLoginPage, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#FAFAF8]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1C1C1A] border-t-transparent" />
          <p className="text-xs font-medium text-[#6B6A62]">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!user && !isLoginPage) {
    return null;
  }

  if (user && isLoginPage) {
    return null;
  }

  if (isLoginPage) {
    return <div className="min-h-screen w-full bg-[#FAFAF8]">{children}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAF8]">
      <Header />
      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar />
        <div className="flex-1 overflow-x-hidden">{children}</div>
      </div>
    </div>
  );
}

