import React from "react";
import { Prompt, WithId } from "@/types/firestore";
import { formatChatTime } from "@/lib/utils";

interface PromptCardProps {
  prompt: WithId<Prompt>;
  handleSetAsDefault: (id: string) => void;
  startEdit: (prompt: WithId<Prompt>) => void;
  setDeleteTarget: (prompt: WithId<Prompt>) => void;
}

export function PromptCard({ prompt: p, handleSetAsDefault, startEdit, setDeleteTarget }: PromptCardProps) {
  return (
    <div className="p-5 space-y-3 transition-colors hover:bg-canvas">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-text-primary">{p.name}</h3>
          {p.is_default && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-active-bg px-2.5 py-0.5 text-[10px] font-medium text-accent-active">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-active" />
              Default Prompt
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!p.is_default && (
            <button
              type="button"
              onClick={() => handleSetAsDefault(p.id)}
              className="rounded border border-border-custom bg-surface px-2.5 py-1 text-[11px] font-medium text-accent-active transition-colors hover:bg-accent-active-bg"
            >
              Make Default
            </button>
          )}

          <button
            type="button"
            onClick={() => startEdit(p)}
            className="rounded border border-border-custom bg-surface px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={() => setDeleteTarget(p)}
            className="rounded border border-border-custom bg-surface px-2.5 py-1 text-[11px] font-medium text-accent-danger transition-colors hover:bg-accent-danger-bg"
          >
            Delete
          </button>
        </div>
      </div>

      <p className="whitespace-pre-wrap font-mono text-xs text-text-secondary bg-canvas p-3 rounded border border-border-custom max-h-36 overflow-y-auto">
        {p.content}
      </p>

      <div className="flex items-center justify-between text-[11px] text-text-muted">
        <span>Modified: {formatChatTime(p.timeModified)}</span>
        <span className="font-mono text-[10px]">ID: {p.id}</span>
      </div>
    </div>
  );
}
