/**
 * Core business logic helpers for WhatsApp Bot Admin
 */

export interface BotState {
  isGlobalActive: boolean;
  defaultPolicyActive: boolean;
  userOverride?: boolean | null;
}

/**
 * Resolves the effective bot active status for a specific contact conversation
 */
export function resolveEffectiveBotActive(state: BotState): boolean {
  if (!state.isGlobalActive) {
    return false;
  }
  if (state.userOverride !== undefined && state.userOverride !== null) {
    return Boolean(state.userOverride);
  }
  return Boolean(state.defaultPolicyActive);
}

export interface PromptDoc {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
}

/**
 * Validates that exactly one prompt document is marked as default
 */
export function validateDefaultPromptUniqueness(prompts: PromptDoc[]): {
  isValid: boolean;
  defaultCount: number;
} {
  const defaultCount = prompts.filter((p) => p.is_default).length;
  return {
    isValid: defaultCount === 1,
    defaultCount,
  };
}

/**
 * Validates prompt deletion safety rules (cannot delete current default prompt without setting another)
 */
export function canDeletePrompt(promptId: string, prompts: PromptDoc[]): {
  allowed: boolean;
  reason?: string;
} {
  const target = prompts.find((p) => p.id === promptId);
  if (!target) {
    return { allowed: false, reason: "Prompt not found." };
  }
  if (target.is_default) {
    return {
      allowed: false,
      reason: "Cannot delete the default prompt. Please set another prompt as default first.",
    };
  }
  return { allowed: true };
}
