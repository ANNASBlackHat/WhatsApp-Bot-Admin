import React from "react";

interface QuietHoursCardProps {
  quietHoursEnabled: boolean;
  setQuietHoursEnabled: (enabled: boolean) => void;
  quietStartTime: string;
  setQuietStartTime: (time: string) => void;
  quietEndTime: string;
  setQuietEndTime: (time: string) => void;
  quietTimezone: string;
  setQuietTimezone: (timezone: string) => void;
  loading: boolean;
  updatingQuiet: boolean;
  quietSaveStatus: string | null;
  handleSaveQuietHours: (e: React.FormEvent) => Promise<void>;
}

export function QuietHoursCard({
  quietHoursEnabled,
  setQuietHoursEnabled,
  quietStartTime,
  setQuietStartTime,
  quietEndTime,
  setQuietEndTime,
  quietTimezone,
  setQuietTimezone,
  loading,
  updatingQuiet,
  quietSaveStatus,
  handleSaveQuietHours,
}: QuietHoursCardProps) {
  return (
    <div className="rounded-lg border border-border-custom bg-surface p-5 shadow-xs space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border-custom pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">🌙</span>
            <h2 className="text-sm font-medium text-text-primary">Scheduled Quiet Hours</h2>
          </div>
          <p className="text-xs text-text-secondary">
            Bound to <code className="font-mono bg-canvas px-1 py-0.5 rounded">wa_bot/{"{waId}"}.quiet_hours</code>. Pauses AI auto-replies across all contacts during specified hours.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-medium text-text-primary">
            {quietHoursEnabled ? "Quiet Hours ON" : "Quiet Hours OFF"}
          </span>

          <button
            type="button"
            disabled={loading}
            onClick={() => setQuietHoursEnabled(!quietHoursEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-text-primary focus:ring-offset-2 ${
              quietHoursEnabled ? "bg-accent-active" : "bg-text-muted"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-sm transition duration-150 ease-in-out ${
                quietHoursEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveQuietHours} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="quiet-start-time" className="block text-xs font-medium text-text-primary mb-1">
              Start Time (24h)
            </label>
            <input
              id="quiet-start-time"
              type="time"
              value={quietStartTime}
              onChange={(e) => setQuietStartTime(e.target.value)}
              className="w-full rounded border border-border-custom bg-canvas px-3 py-2 text-xs text-text-primary focus:border-text-primary focus:bg-surface focus:outline-none focus:ring-1 focus:ring-text-primary"
            />
          </div>

          <div>
            <label htmlFor="quiet-end-time" className="block text-xs font-medium text-text-primary mb-1">
              End Time (24h)
            </label>
            <input
              id="quiet-end-time"
              type="time"
              value={quietEndTime}
              onChange={(e) => setQuietEndTime(e.target.value)}
              className="w-full rounded border border-border-custom bg-canvas px-3 py-2 text-xs text-text-primary focus:border-text-primary focus:bg-surface focus:outline-none focus:ring-1 focus:ring-text-primary"
            />
          </div>

          <div>
            <label htmlFor="quiet-timezone" className="block text-xs font-medium text-text-primary mb-1">
              Timezone
            </label>
            <input
              id="quiet-timezone"
              type="text"
              value={quietTimezone}
              onChange={(e) => setQuietTimezone(e.target.value)}
              placeholder="e.g. Asia/Jakarta"
              className="w-full rounded border border-border-custom bg-canvas px-3 py-2 text-xs text-text-primary focus:border-text-primary focus:bg-surface focus:outline-none focus:ring-1 focus:ring-text-primary"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {quietSaveStatus ? (
            <span className="text-xs font-medium text-accent-active">{quietSaveStatus}</span>
          ) : <span />}

          <button
            type="submit"
            disabled={updatingQuiet || loading}
            className="rounded bg-text-primary px-4 py-2 text-xs font-medium text-surface transition-colors hover:bg-text-primary/90 focus:outline-none focus:ring-2 focus:ring-text-primary disabled:opacity-50"
          >
            {updatingQuiet ? "Saving Quiet Hours..." : "Save Quiet Hours Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
