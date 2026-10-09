import React from "react";

interface PromptEditorFormProps {
  isEditing: boolean;
  nameInput: string;
  setNameInput: (val: string) => void;
  contentInput: string;
  setContentInput: (val: string) => void;
  isDefaultInput: boolean;
  setIsDefaultInput: (val: boolean) => void;
  isSaving: boolean;
  handleSavePrompt: (e: React.FormEvent) => Promise<void>;
  resetForm: () => void;
}

export function PromptEditorForm({
  isEditing,
  nameInput,
  setNameInput,
  contentInput,
  setContentInput,
  isDefaultInput,
  setIsDefaultInput,
  isSaving,
  handleSavePrompt,
  resetForm,
}: PromptEditorFormProps) {
  return (
    <div className="rounded-lg border border-border-custom bg-surface p-5 shadow-xs lg:col-span-1 space-y-4">
      <div className="flex items-center justify-between border-b border-border-custom pb-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary">
          {isEditing ? "Edit System Prompt" : "Create New Prompt"}
        </h2>
        {isEditing && (
          <button
            type="button"
            onClick={resetForm}
            className="text-xs text-text-secondary underline hover:text-text-primary"
          >
            Cancel edit
          </button>
        )}
      </div>

      <form onSubmit={handleSavePrompt} className="space-y-4">
        <div>
          <label htmlFor="prompt-name" className="block text-xs font-medium text-text-primary mb-1">
            Prompt Name
          </label>
          <input
            id="prompt-name"
            type="text"
            placeholder="e.g. Nindia Persona v1"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="w-full rounded border border-border-custom bg-canvas px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:border-text-primary focus:bg-surface focus:outline-none focus:ring-1 focus:ring-text-primary"
          />
        </div>

        <div>
          <label htmlFor="prompt-content" className="block text-xs font-medium text-text-primary mb-1">
            System Instructions (Content)
          </label>
          <textarea
            id="prompt-content"
            rows={10}
            placeholder="Enter multi-line system prompt instructions here..."
            value={contentInput}
            onChange={(e) => setContentInput(e.target.value)}
            className="w-full rounded border border-border-custom bg-canvas p-3 text-xs font-mono text-text-primary placeholder-text-muted focus:border-text-primary focus:bg-surface focus:outline-none focus:ring-1 focus:ring-text-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="is-default-checkbox"
            type="checkbox"
            checked={isDefaultInput}
            onChange={(e) => setIsDefaultInput(e.target.checked)}
            className="h-4 w-4 rounded border-border-custom text-text-primary focus:ring-text-primary"
          />
          <label htmlFor="is-default-checkbox" className="text-xs text-text-primary">
            Set as default system prompt for account
          </label>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full rounded bg-text-primary py-2 text-xs font-medium text-surface transition-colors hover:bg-text-primary/90 focus:outline-none focus:ring-2 focus:ring-text-primary disabled:opacity-50"
        >
          {isSaving ? "Saving..." : isEditing ? "Update Prompt" : "Create Prompt"}
        </button>
      </form>
    </div>
  );
}
