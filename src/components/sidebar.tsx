"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useChats } from "@/lib/chats-context";

export function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const { totalUnreadCount } = useChats();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  const rawWaId = params?.waId as string | undefined;
  const waId = rawWaId ? decodeURIComponent(rawWaId) : "";

  const basePrefix = waId ? `/${encodeURIComponent(waId)}` : "";

  // Load initial collapse state from localStorage / cookie on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem("sidebar_collapsed");
      if (savedState !== null) {
        setIsCollapsed(savedState === "true");
      } else {
        const match = document.cookie.match(/(?:^|; )sidebar_collapsed=([^;]*)/);
        if (match) {
          setIsCollapsed(match[1] === "true");
        }
      }
    } catch (e) {
      console.error("Failed to read sidebar preference:", e);
    }
    setMounted(true);
  }, []);

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    try {
      localStorage.setItem("sidebar_collapsed", String(nextState));
      document.cookie = `sidebar_collapsed=${nextState}; path=/; max-age=31536000`;
    } catch (e) {
      console.error("Failed to save sidebar preference:", e);
    }
  };

  const navItems = [
    {
      name: "Contacts",
      href: `${basePrefix}`,
      badge: totalUnreadCount > 0 ? (totalUnreadCount > 99 ? "99+" : totalUnreadCount) : null,
      icon: (
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      name: "Dashboard",
      href: `${basePrefix}/dashboard`,
      badge: null,
      icon: (
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      name: "Prompts",
      href: `${basePrefix}/settings/prompts`,
      badge: null,
      icon: (
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
        </svg>
      ),
    },
    {
      name: "Settings",
      href: `${basePrefix}/settings`,
      badge: null,
      icon: (
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <aside
      className={`w-full border-b border-border-custom bg-surface transition-[width] duration-150 ease-out motion-reduce:transition-none md:border-r md:border-b-0 ${
        isCollapsed ? "md:w-16" : "md:w-56"
      } md:shrink-0 flex flex-col justify-between`}
    >
      <nav className="flex flex-row p-2 md:flex-col md:gap-1 md:p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === basePrefix || item.href === `${basePrefix}/`
              ? pathname === basePrefix || pathname === `${basePrefix}/` || pathname?.startsWith(`${basePrefix}/contacts`)
              : item.href === `${basePrefix}/settings`
              ? pathname === `${basePrefix}/settings`
              : pathname === item.href || pathname?.startsWith(item.href + "/");

          return (
            <div key={item.name} className="relative group flex-1 md:flex-none">
              <Link
                href={item.href}
                title={isCollapsed ? item.name : undefined}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  isCollapsed ? "md:justify-center md:px-0" : ""
                } ${
                  isActive
                    ? "border-l-2 border-text-primary bg-surface-hover text-text-primary"
                    : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative flex items-center">
                    <span className={isActive ? "text-text-primary" : "text-text-secondary"}>
                      {item.icon}
                    </span>
                    {/* Badge when collapsed */}
                    {isCollapsed && item.badge !== null && (
                      <span className="hidden md:inline-flex absolute -top-1.5 -right-2 h-4 min-w-4 items-center justify-center rounded-full bg-accent-danger px-1 text-[9px] font-bold text-white leading-none">
                        {item.badge}
                      </span>
                    )}
                  </div>

                  <span className={isCollapsed ? "md:hidden" : ""}>
                    {item.name}
                  </span>
                </div>

                {/* Badge when expanded */}
                {item.badge !== null && (
                  <span className={`${isCollapsed ? "md:hidden" : "inline-flex"} items-center justify-center rounded-full bg-accent-danger px-1.5 py-0.5 text-[10px] font-bold text-white leading-none`}>
                    {item.badge}
                  </span>
                )}
              </Link>

              {/* Hover Tooltip when collapsed */}
              {isCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden md:group-hover:flex items-center z-50">
                  <div className="rounded bg-text-primary px-2.5 py-1 text-[11px] font-medium text-surface shadow-md whitespace-nowrap">
                    {item.name}
                    {item.badge !== null && ` (${item.badge})`}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Manual Collapse / Expand Toggle Button at bottom */}
      <div className="hidden md:block p-2 border-t border-border-custom">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus:outline-none focus:ring-1 focus:ring-text-primary ${
            isCollapsed ? "justify-center px-0" : ""
          }`}
        >
          <svg
            className={`h-4 w-4 shrink-0 transition-transform duration-150 motion-reduce:transition-none ${
              isCollapsed ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          <span className={isCollapsed ? "md:hidden" : ""}>
            Collapse sidebar
          </span>
        </button>
      </div>
    </aside>
  );
}

