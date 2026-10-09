import React from "react";
import { Prompt, WithId } from "@/types/firestore";

interface DeletePromptModalProps {
  deleteTarget: WithId<Prompt>;
  isDeleting: boolean;
  setDeleteTarget: (prompt: WithId<Prompt> | null) => void;
  handleDeletePrompt: () => Promise<void>;
}

export function DeletePromptModal({
  deleteTarget,
  isDeleting,
  setDeleteTarget,
  handleDeletePrompt,
}: DeletePromptModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border-custom bg-surface p-6 shadow-lg space-y-4">
        <h3 className="text-base font-medium text-text-primary">Delete Prompt Template?</h3>
        <p className="text-xs leading-relaxed text-text-secondary">
          Are you sure you want to delete prompt &quot;<strong>{deleteTarget.name}</strong>&quot;?
          {deleteTarget.is_default && (
            <span className="block mt-1 text-accent-danger font-medium">
              Warning: You cannot delete the active default prompt without setting another prompt as default first.
            </span>
          )}
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => setDeleteTarget(null)}
            className="rounded border border-border-custom bg-canvas px-4 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting || deleteTarget.is_default}
            onClick={handleDeletePrompt}
            className="rounded bg-accent-danger px-4 py-2 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete Prompt"}
          </button>
        </div>
      </div>
    </div>
  );
}
