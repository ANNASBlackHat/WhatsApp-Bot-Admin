import React from "react";

interface GlobalKillSwitchCardProps {
  totalChatsCount: number;
  isGlobalActive: boolean;
  updatingGlobal: boolean;
  loading: boolean;
  handleInitiateGlobalToggle: (nextState: boolean) => void;
}

export function GlobalKillSwitchCard({
  totalChatsCount,
  isGlobalActive,
  updatingGlobal,
  loading,
  handleInitiateGlobalToggle,
}: GlobalKillSwitchCardProps) {
  return (
    <div className="rounded-lg border border-accent-danger/30 bg-accent-danger-bg p-5 shadow-xs">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-accent-danger animate-pulse" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-accent-danger">
              Global Master Kill Switch
            </h2>
          </div>
          <p className="text-xs text-text-primary leading-relaxed">
            Bound to <code className="font-mono bg-surface px-1 py-0.5 rounded text-[11px]">wa_bot/{"{waId}"}.is_bot_active</code>. Turning this OFF immediately stops AI auto-replies across <strong>ALL {totalChatsCount} contacts</strong> on this account.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-medium text-text-primary">
            {isGlobalActive ? "Global Bot ON" : "Global Bot OFF"}
          </span>

          <button
            type="button"
            disabled={updatingGlobal || loading}
            onClick={() => handleInitiateGlobalToggle(!isGlobalActive)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent-danger focus:ring-offset-2 disabled:opacity-50 ${
              isGlobalActive ? "bg-accent-active" : "bg-accent-danger"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-sm transition duration-150 ease-in-out ${
                isGlobalActive ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
