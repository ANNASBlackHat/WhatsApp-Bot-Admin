"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AccountSwitcher } from "@/components/account-switcher";

export function Header() {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-[#E7E5DD] bg-[#FFFFFF] px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-medium text-[#1C1C1A]">WhatsApp Bot Admin</h1>
        {user && <AccountSwitcher />}
      </div>

      {user && (
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#6B6A62]" title={user.email || ""}>
            {user.email}
          </span>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="inline-flex items-center justify-center rounded border border-[#E7E5DD] bg-transparent px-3 py-1.5 text-xs font-medium text-[#1C1C1A] transition-colors hover:bg-[#F3F2ED] focus:outline-none focus:ring-2 focus:ring-[#1C1C1A] focus:ring-offset-2 disabled:opacity-50"
          >
            {isLoggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      )}
    </header>
  );
}
