import React from "react";

interface ChatFoldersManagerProps {
  builtins: { key: string; name: string }[];
  shownBuiltins: Record<string, string>;
  setDraftBuiltins: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  shownCustoms: { key: string; name: string }[];
  setDraftCustoms: React.Dispatch<React.SetStateAction<{ key: string; name: string }[]>>;
  ensureSeeded: () => void;
  handleRemoveCustomFolder: (key: string) => void;
  newFolderName: string;
  setNewFolderName: (name: string) => void;
  handleAddCustomFolder: () => void;
  folderSaveStatus: string | null;
  handleSaveFolders: () => void;
  updatingFolders: boolean;
  loading: boolean;
  hasEdits: boolean;
}

export function ChatFoldersManager({
  builtins,
  shownBuiltins,
  setDraftBuiltins,
  shownCustoms,
  setDraftCustoms,
  ensureSeeded,
  handleRemoveCustomFolder,
  newFolderName,
  setNewFolderName,
  handleAddCustomFolder,
  folderSaveStatus,
  handleSaveFolders,
  updatingFolders,
  loading,
  hasEdits,
}: ChatFoldersManagerProps) {
  return (
    <div className="rounded-lg border border-border-custom bg-surface p-5 shadow-xs space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-base">🗂️</span>
          <h2 className="text-sm font-medium text-text-primary">Chat Folders</h2>
        </div>
        <p className="text-xs text-text-secondary">
          Bound to <code className="font-mono bg-canvas px-1 py-0.5 rounded">wa_bot/{"{waId}"}.folders</code>. Renames built-in tab labels or adds custom folder tabs. Removing a custom folder moves its chats back to the default view.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {builtins.map((b) => (
          <div key={b.key}>
            <label htmlFor={`folder-label-${b.key}`} className="block text-[11px] font-medium text-text-primary mb-1">
              Built-in: “{b.name}” label
            </label>
            <input
              id={`folder-label-${b.key}`}
              type="text"
              value={shownBuiltins[b.key] ?? b.name}
              onChange={(e) => {
                ensureSeeded();
                setDraftBuiltins((prev) => ({ ...prev, [b.key]: e.target.value }));
              }}
              className="w-full rounded border border-border-custom bg-canvas px-3 py-2 text-xs text-text-primary focus:border-text-primary focus:outline-none focus:ring-1 focus:ring-text-primary"
            />
          </div>
        ))}
      </div>

      {shownCustoms.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-text-primary">Custom folders</p>
          {shownCustoms.map((f) => (
            <div key={f.key} className="flex items-center gap-2">
              <input
                type="text"
                defaultValue={f.name}
                key={`${f.key}-${f.name}`}
                onChange={(e) => {
                  ensureSeeded();
                  setDraftCustoms((prev) =>
                    prev.map((c) => (c.key === f.key ? { ...c, name: e.target.value } : c))
                  );
                }}
                className="flex-1 rounded border border-border-custom bg-canvas px-3 py-2 text-xs text-text-primary focus:border-text-primary focus:outline-none focus:ring-1 focus:ring-text-primary"
              />
              <button
                type="button"
                onClick={() => handleRemoveCustomFolder(f.key)}
                className="rounded border border-accent-danger/30 bg-accent-danger-bg px-2.5 py-2 text-[11px] font-medium text-accent-danger hover:bg-accent-danger/20"
                title={`Remove “${f.name}” (chats in it return to the default view)`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="new-folder-name" className="block text-[11px] font-medium text-text-primary mb-1">
            Add custom folder
          </label>
          <input
            id="new-folder-name"
            type="text"
            value={newFolderName}
            placeholder="e.g. Clients, VIP"
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddCustomFolder()}
            className="w-full rounded border border-border-custom bg-canvas px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:border-text-primary focus:outline-none focus:ring-1 focus:ring-text-primary"
          />
        </div>
        <button
          type="button"
          onClick={handleAddCustomFolder}
          disabled={!newFolderName.trim()}
          className="rounded border border-border-custom bg-surface px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <div className="flex items-center justify-between pt-1">
        {folderSaveStatus ? (
          <span className={`text-xs font-medium ${folderSaveStatus.includes("saved") ? "text-accent-active" : "text-accent-danger"}`}>
            {folderSaveStatus}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={handleSaveFolders}
          disabled={updatingFolders || loading || !hasEdits}
          className="rounded bg-text-primary px-4 py-2 text-xs font-medium text-surface transition-colors hover:bg-text-primary/90 disabled:opacity-50"
        >
          {updatingFolders ? "Saving…" : "Save Folders"}
        </button>
      </div>
    </div>
  );
}
