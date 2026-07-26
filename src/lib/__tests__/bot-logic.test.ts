import assert from "node:assert";
import {
  canDeletePrompt,
  resolveEffectiveBotActive,
  validateDefaultPromptUniqueness,
} from "../bot-logic";

// Test 1: Global bot kill switch overrides per-contact settings
{
  const result = resolveEffectiveBotActive({
    isGlobalActive: false,
    defaultPolicyActive: true,
    userOverride: true,
  });
  assert.strictEqual(result, false, "Global kill switch must override explicit true");
}

// Test 2: Explicit per-contact true override
{
  const result = resolveEffectiveBotActive({
    isGlobalActive: true,
    defaultPolicyActive: false,
    userOverride: true,
  });
  assert.strictEqual(result, true, "Explicit user override true must override default policy false");
}

// Test 3: Explicit per-contact false override
{
  const result = resolveEffectiveBotActive({
    isGlobalActive: true,
    defaultPolicyActive: true,
    userOverride: false,
  });
  assert.strictEqual(result, false, "Explicit user override false must override default policy true");
}

// Test 4: Default policy fallback when userOverride is null/undefined
{
  const result = resolveEffectiveBotActive({
    isGlobalActive: true,
    defaultPolicyActive: true,
    userOverride: null,
  });
  assert.strictEqual(result, true, "Unset user override must fall back to default policy");
}

// Test 5: Default prompt uniqueness validation
{
  const prompts = [
    { id: "1", name: "Prompt 1", content: "c1", is_default: true },
    { id: "2", name: "Prompt 2", content: "c2", is_default: false },
  ];
  const { isValid, defaultCount } = validateDefaultPromptUniqueness(prompts);
  assert.strictEqual(isValid, true);
  assert.strictEqual(defaultCount, 1);
}

// Test 6: Zero default prompts invalid
{
  const prompts = [
    { id: "1", name: "Prompt 1", content: "c1", is_default: false },
    { id: "2", name: "Prompt 2", content: "c2", is_default: false },
  ];
  const { isValid, defaultCount } = validateDefaultPromptUniqueness(prompts);
  assert.strictEqual(isValid, false);
  assert.strictEqual(defaultCount, 0);
}

// Test 7: Prompt deletion safety rules
{
  const prompts = [
    { id: "1", name: "Default Persona", content: "c1", is_default: true },
    { id: "2", name: "Custom Persona", content: "c2", is_default: false },
  ];
  const checkDefault = canDeletePrompt("1", prompts);
  assert.strictEqual(checkDefault.allowed, false, "Must block deletion of active default prompt");

  const checkCustom = canDeletePrompt("2", prompts);
  assert.strictEqual(checkCustom.allowed, true, "Must allow deletion of non-default prompt");
}

console.log("✓ All core write path logic unit tests passed successfully!");
