"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { promptDoc, promptsCollection } from "@/lib/firestore-paths";
import { Prompt, WithId } from "@/types/firestore";
import { formatChatTime } from "@/lib/utils";

// Verbatim Nindia persona prompt text from core/ai_prompt.go for seeding
const NINDIA_SEED_PROMPT = `Nama kamu adalah Nindia. Kamu adalah seorang wanita berusia 20-an awal (sekitar 21-22 tahun).
Karaktermu ramah, santai, cerdas, sedikit humoris, dan suka mengobrol hal-hal kasual layaknya teman akrab di WhatsApp.

Aturan Komunikasi:
1. Gunakan bahasa Indonesia sehari-hari/gaul yang wajar (seperti: aku, kamu, ya, sih, deh, wkwk, dsb).
2. Balas pesan secara alami, singkat, padat, dan mirip pesan WhatsApp manusia sungguhan.
3. Jangan pernah mengaku sebagai AI, bot, atau program komputer.
4. Jawab pertanyaan dengan gaya pembicaraan santai.`;

interface PageProps {
  params: Promise<{ waId: string }>;
}

export default function PromptsPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const waId = decodeURIComponent(resolvedParams.waId);

  const [prompts, setPrompts] = useState<WithId<Prompt>[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(waId));
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState<string>("");
  const [contentInput, setContentInput] = useState<string>("");
  const [isDefaultInput, setIsDefaultInput] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Modal states
  const [deleteTarget, setDeleteTarget] = useState<WithId<Prompt> | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  useEffect(() => {
    if (!waId) return;

    const unsubPrompts = onSnapshot(
      collection(db, promptsCollection(waId)),
      (snapshot) => {
        const list: WithId<Prompt>[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Prompt),
        }));

        // Sort: default prompt first, then by timeModified desc
        list.sort((a, b) => {
          if (a.is_default && !b.is_default) return -1;
          if (!a.is_default && b.is_default) return 1;
          return (b.timeModified || 0) - (a.timeModified || 0);
        });

        setPrompts(list);
        setLoading(false);
      },
      (err) => {
        console.error("Prompts listener error:", err);
        setError("Failed to load prompts library. Please check Firestore permissions.");
        setLoading(false);
      }
    );

    return () => unsubPrompts();
  }, [waId]);

  // Reset form to default create state
  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setNameInput("");
    setContentInput("");
    setIsDefaultInput(false);
  };

  // Open edit mode
  const startEdit = (promptDocObj: WithId<Prompt>) => {
    setIsEditing(true);
    setEditingId(promptDocObj.id);
    setNameInput(promptDocObj.name || "");
    setContentInput(promptDocObj.content || "");
    setIsDefaultInput(Boolean(promptDocObj.is_default));
  };

  // Seed default Nindia prompt if collection is empty
  const handleSeedNindiaPrompt = async () => {
    try {
      setIsSeeding(true);
      setError(null);

      const now = Date.now();
      await addDoc(collection(db, promptsCollection(waId)), {
        name: "Nindia Persona (Default)",
        content: NINDIA_SEED_PROMPT,
        is_default: true,
        timeCreated: now,
        timeModified: now,
      });
    } catch (err) {
      console.error("Failed to seed prompt:", err);
      setError("Failed to seed default prompt document.");
    } finally {
      setIsSeeding(false);
    }
  };

  // Create or Update Prompt
  const handleSavePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || !contentInput.trim()) {
      setError("Name and Content fields are required.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const now = Date.now();

      if (isEditing && editingId) {
        const targetRef = doc(db, promptDoc(waId, editingId));

        if (isDefaultInput) {
          // If setting as default, use transaction to unset existing default atomically
          await runTransaction(db, async (transaction) => {
            prompts.forEach((p) => {
              if (p.id !== editingId && p.is_default) {
                transaction.update(doc(db, promptDoc(waId, p.id)), {
                  is_default: false,
                  timeModified: now,
                });
              }
            });
            transaction.update(targetRef, {
              name: nameInput.trim(),
              content: contentInput.trim(),
              is_default: true,
              timeModified: now,
            });
          });
        } else {
          // Normal edit
          await updateDoc(targetRef, {
            name: nameInput.trim(),
            content: contentInput.trim(),
            is_default: false,
            timeModified: now,
          });
        }
      } else {
        // Create new prompt
        const isFirstPrompt = prompts.length === 0;
        const makeDefault = isDefaultInput || isFirstPrompt;

        if (makeDefault) {
          await runTransaction(db, async (transaction) => {
            prompts.forEach((p) => {
              if (p.is_default) {
                transaction.update(doc(db, promptDoc(waId, p.id)), {
                  is_default: false,
                  timeModified: now,
                });
              }
            });
            const newRef = doc(collection(db, promptsCollection(waId)));
            transaction.set(newRef, {
              name: nameInput.trim(),
              content: contentInput.trim(),
              is_default: true,
              timeCreated: now,
              timeModified: now,
            });
          });
        } else {
          await addDoc(collection(db, promptsCollection(waId)), {
            name: nameInput.trim(),
            content: contentInput.trim(),
            is_default: false,
            timeCreated: now,
            timeModified: now,
          });
        }
      }

      resetForm();
    } catch (err) {
      console.error("Failed to save prompt:", err);
      setError("Failed to save prompt document.");
    } finally {
      setIsSaving(false);
    }
  };

  // Atomic "Set as Default" Transaction
  const handleSetAsDefault = async (targetId: string) => {
    try {
      setError(null);

      await runTransaction(db, async (transaction) => {
        const now = Date.now();
        prompts.forEach((p) => {
          const pRef = doc(db, promptDoc(waId, p.id));
          if (p.id === targetId) {
            transaction.update(pRef, { is_default: true, timeModified: now });
          } else if (p.is_default) {
            transaction.update(pRef, { is_default: false, timeModified: now });
          }
        });
      });
    } catch (err) {

      console.error("Failed to set default prompt:", err);
      setError("Failed to update default prompt atomically.");
    }
  };

  // Delete Prompt
  const handleDeletePrompt = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.is_default) {
      setError("Cannot delete the active default prompt. Please set another prompt as default first.");
      setDeleteTarget(null);
      return;
    }

    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, promptDoc(waId, deleteTarget.id)));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete prompt:", err);
      setError("Failed to delete prompt document.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/${encodeURIComponent(waId)}/settings`}
              className="text-xs text-[#6B6A62] hover:text-[#1C1C1A]"
            >
              ← Settings
            </Link>
            <span className="text-xs text-[#A6A499]">\</span>
            <h1 className="text-xl font-medium text-[#1C1C1A]">Prompt Library</h1>
          </div>
          <p className="mt-1 text-xs text-[#6B6A62]">
            Create and manage AI system prompt templates for account <code className="font-mono text-[#1C1C1A] font-medium">{waId}</code>
          </p>
        </div>

        {prompts.length === 0 && !loading && (
          <button
            type="button"
            disabled={isSeeding}
            onClick={handleSeedNindiaPrompt}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E7E5DD] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#2F7A5C] transition-colors hover:bg-[#E7F1EB]"
          >
            {isSeeding ? "Seeding..." : "✨ Seed Default Nindia Prompt"}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-[#E7E5DD] bg-[#FAFAF8] p-4 text-xs text-[#B23B31]">
          {error}
        </div>
      )}

      {/* Main Layout: Form (left/top) + List (right/bottom) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Form Card */}
        <div className="rounded-lg border border-[#E7E5DD] bg-[#FFFFFF] p-5 shadow-xs lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E7E5DD] pb-3">
            <h2 className="text-xs font-medium uppercase tracking-wider text-[#6B6A62]">
              {isEditing ? "Edit System Prompt" : "Create New Prompt"}
            </h2>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-[#6B6A62] underline hover:text-[#1C1C1A]"
              >
                Cancel edit
              </button>
            )}
          </div>

          <form onSubmit={handleSavePrompt} className="space-y-4">
            <div>
              <label htmlFor="prompt-name" className="block text-xs font-medium text-[#1C1C1A] mb-1">
                Prompt Name
              </label>
              <input
                id="prompt-name"
                type="text"
                placeholder="e.g. Nindia Persona v1"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full rounded border border-[#E7E5DD] bg-[#FAFAF8] px-3 py-2 text-xs text-[#1C1C1A] placeholder-[#A6A499] focus:border-[#1C1C1A] focus:bg-[#FFFFFF] focus:outline-none focus:ring-1 focus:ring-[#1C1C1A]"
              />
            </div>

            <div>
              <label htmlFor="prompt-content" className="block text-xs font-medium text-[#1C1C1A] mb-1">
                System Instructions (Content)
              </label>
              <textarea
                id="prompt-content"
                rows={10}
                placeholder="Enter multi-line system prompt instructions here..."
                value={contentInput}
                onChange={(e) => setContentInput(e.target.value)}
                className="w-full rounded border border-[#E7E5DD] bg-[#FAFAF8] p-3 text-xs font-mono text-[#1C1C1A] placeholder-[#A6A499] focus:border-[#1C1C1A] focus:bg-[#FFFFFF] focus:outline-none focus:ring-1 focus:ring-[#1C1C1A]"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="is-default-checkbox"
                type="checkbox"
                checked={isDefaultInput}
                onChange={(e) => setIsDefaultInput(e.target.checked)}
                className="h-4 w-4 rounded border-[#E7E5DD] text-[#1C1C1A] focus:ring-[#1C1C1A]"
              />
              <label htmlFor="is-default-checkbox" className="text-xs text-[#1C1C1A]">
                Set as default system prompt for account
              </label>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded bg-[#1C1C1A] py-2 text-xs font-medium text-[#FFFFFF] transition-colors hover:bg-[#333330] focus:outline-none focus:ring-2 focus:ring-[#1C1C1A] disabled:opacity-50"
            >
              {isSaving ? "Saving..." : isEditing ? "Update Prompt" : "Create Prompt"}
            </button>
          </form>
        </div>

        {/* Right Column: Prompts List Container */}
        <div className="overflow-hidden rounded-lg border border-[#E7E5DD] bg-[#FFFFFF] shadow-xs lg:col-span-2">
          <div className="border-b border-[#E7E5DD] px-5 py-3 bg-[#FAFAF8]">
            <h2 className="text-xs font-medium uppercase tracking-wider text-[#6B6A62]">
              Prompts Library ({prompts.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-[#6B6A62]">Loading prompts library...</div>
          ) : prompts.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-sm font-medium text-[#1C1C1A]">No prompt templates created yet</p>
              <p className="text-xs text-[#6B6A62]">
                Create a new prompt using the form on the left or seed the default Nindia persona.
              </p>
              <button
                type="button"
                disabled={isSeeding}
                onClick={handleSeedNindiaPrompt}
                className="inline-flex items-center gap-1.5 rounded bg-[#1C1C1A] px-4 py-2 text-xs font-medium text-[#FFFFFF] transition-colors hover:bg-[#333330]"
              >
                {isSeeding ? "Seeding..." : "✨ Seed Default Nindia Prompt"}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#E7E5DD]">
              {prompts.map((p) => (
                <div key={p.id} className="p-5 space-y-3 transition-colors hover:bg-[#FAFAF8]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-[#1C1C1A]">{p.name}</h3>
                      {p.is_default && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F1EB] px-2.5 py-0.5 text-[10px] font-medium text-[#2F7A5C]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#2F7A5C]" />
                          Default Prompt
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!p.is_default && (
                        <button
                          type="button"
                          onClick={() => handleSetAsDefault(p.id)}
                          className="rounded border border-[#E7E5DD] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-medium text-[#2F7A5C] transition-colors hover:bg-[#E7F1EB]"
                        >
                          Make Default
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        className="rounded border border-[#E7E5DD] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-medium text-[#6B6A62] transition-colors hover:bg-[#F3F2ED] hover:text-[#1C1C1A]"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(p)}
                        className="rounded border border-[#E7E5DD] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-medium text-[#B23B31] transition-colors hover:bg-[#F5E4E1]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <p className="whitespace-pre-wrap font-mono text-xs text-[#6B6A62] bg-[#FAFAF8] p-3 rounded border border-[#E7E5DD] max-h-36 overflow-y-auto">
                    {p.content}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-[#A6A499]">
                    <span>Modified: {formatChatTime(p.timeModified)}</span>
                    <span className="font-mono text-[10px]">ID: {p.id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1C1A]/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#E7E5DD] bg-[#FFFFFF] p-6 shadow-lg space-y-4">
            <h3 className="text-base font-medium text-[#1C1C1A]">Delete Prompt Template?</h3>
            <p className="text-xs leading-relaxed text-[#6B6A62]">
              Are you sure you want to delete prompt &quot;<strong>{deleteTarget.name}</strong>&quot;?
              {deleteTarget.is_default && (
                <span className="block mt-1 text-[#B23B31] font-medium">
                  Warning: You cannot delete the active default prompt without setting another prompt as default first.
                </span>
              )}
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="rounded border border-[#E7E5DD] bg-[#FAFAF8] px-4 py-2 text-xs font-medium text-[#1C1C1A] transition-colors hover:bg-[#F3F2ED]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting || deleteTarget.is_default}
                onClick={handleDeletePrompt}
                className="rounded bg-[#B23B31] px-4 py-2 text-xs font-medium text-[#FFFFFF] transition-colors hover:bg-[#962F26] disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Prompt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
