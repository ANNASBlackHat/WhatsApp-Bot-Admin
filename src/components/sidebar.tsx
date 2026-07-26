"use client";

import React from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const rawWaId = params?.waId as string | undefined;
  const waId = rawWaId ? decodeURIComponent(rawWaId) : "";

  const basePrefix = waId ? `/${encodeURIComponent(waId)}` : "";

  const navItems = [
    {
      name: "Contacts",
      href: `${basePrefix}`,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      name: "Dashboard",
      href: `${basePrefix}/dashboard`,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      name: "Prompts",
      href: `${basePrefix}/settings/prompts`,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
        </svg>
      ),
    },
    {
      name: "Settings",
      href: `${basePrefix}/settings`,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="w-full border-b border-[#E7E5DD] bg-[#FFFFFF] md:w-56 md:shrink-0 md:border-r md:border-b-0">
      <nav className="flex flex-row p-2 md:flex-col md:gap-1 md:p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === basePrefix || item.href === `${basePrefix}/`
              ? pathname === basePrefix || pathname === `${basePrefix}/` || pathname?.startsWith(`${basePrefix}/contacts`)
              : item.href === `${basePrefix}/settings`
              ? pathname === `${basePrefix}/settings`
              : pathname === item.href || pathname?.startsWith(item.href + "/");

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-1 items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium transition-colors md:flex-none ${
                isActive
                  ? "border-l-2 border-[#1C1C1A] bg-[#F3F2ED] text-[#1C1C1A]"
                  : "text-[#6B6A62] hover:bg-[#F3F2ED] hover:text-[#1C1C1A]"
              }`}
            >
              <span className={isActive ? "text-[#1C1C1A]" : "text-[#6B6A62]"}>
                {item.icon}
              </span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
