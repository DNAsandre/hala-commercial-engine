/**
 * final-pack-bot-runtime.ts
 * ─────────────────────────
 * FPS-008-09 — Selected Bot Builder microbot runtime call (preview-only).
 *
 * Runs ONE discovered microbot against ONE editable block and returns the AI
 * output as a LOCAL PREVIEW PAYLOAD. It never mutates block content, source
 * data, templates, reusable blocks, or export. It never throws into the editor.
 *
 * STRICT (FPS-008):
 * - Prompt comes ONLY from ai_bot_versions.system_instruction (+ safety_rules /
 *   custom_instruction). No hardcoded prompts.
 * - Runs ONLY via the approved generateAI() path. No bot-governance.ts mock,
 *   no executeRuntimeInvocationFlow, no generateMockOutput, no fallback bots.
 * - Re-verifies the bot is still active + eligible at run time (a bot disabled
 *   in Bot Builder cannot run, even if it was discovered earlier).
 */

import { supabase } from "@/lib/supabase";
import { generateAI, fetchAIProviders, logBlockAIAudit } from "@/lib/ai-client";
import { PDF_STUDIO_DOMAIN, type DiscoveredBot } from "@/lib/final-pack-bots";
import {
  assembleBlockAIContext,
  buildUserPrompt,
  type BlockAIContext,
  type BlockAIDocContext,
} from "@/lib/final-pack-bot-context";
import {
  validateBlockAIOutput,
  type BlockAIValidation,
} from "@/lib/final-pack-bot-validation";
import type { OutputBlock } from "@/lib/final-pack-loader";

/** Status of a block-AI run. Preview-only; not applied to the block. */
export type BlockAIPreviewStatus = "running" | "success" | "error";

/** The local preview payload produced by a run. */
export interface BlockAIPreview {
  status: BlockAIPreviewStatus;
  /** Raw bot output text — PREVIEW ONLY; never auto-applied. */
  content?: string;
  /** FPS-008-10 validation of the raw output (present when status==="success"). */
  validation?: BlockAIValidation;
  /** Advisory error message when status === "error". */
  error?: string;
  bot_id: string;
  bot_name: string;
  bot_category: string;
  version_id: string | null;
  provider?: string;
  model?: string;
  tokens_input?: number;
  tokens_output?: number;
  latency_ms?: number;
  /** The exact scoped context that was sent (for the minimal debug card). */
  context: BlockAIContext;
  created_at: string;
}

function allowsBlock(allowed: string[] | null | undefined, blockType: string): boolean {
  if (!Array.isArray(allowed) || allowed.length === 0) return true; // allow broadly
  return allowed.includes(blockType);
}

/**
 * Run a microbot against a block. Always resolves (never rejects) — failures
 * come back as a status:"error" preview so the editor is never blocked.
 */
export async function runBlockAIMicrobot(params: {
  bot: DiscoveredBot;
  block: OutputBlock;
  doc: BlockAIDocContext;
  userInstruction?: string;
}): Promise<BlockAIPreview> {
  const { bot, block, doc, userInstruction } = params;
  const context = assembleBlockAIContext({ block, doc, bot, userInstruction });
  const base: BlockAIPreview = {
    status: "error",
    bot_id: bot.id,
    bot_name: bot.display_name,
    bot_category: bot.category,
    version_id: bot.current_version_id ?? null,
    context,
    created_at: new Date().toISOString(),
  };

  // FPS-008-14: best-effort audit of every run outcome, then return the preview.
  // Audit failure is swallowed inside logBlockAIAudit — it never blocks the editor.
  const finish = async (preview: BlockAIPreview): Promise<BlockAIPreview> => {
    await logBlockAIAudit({
      provider: preview.provider,
      model: preview.model,
      tokensInput: preview.tokens_input,
      tokensOutput: preview.tokens_output,
      latencyMs: preview.latency_ms,
      status: preview.status === "success" ? "success" : "error",
      errorMessage: preview.error,
      botId: bot.id,
      botName: bot.display_name,
      docInstanceId: doc.doc_instance_id,
      blockId: block.id,
      humanAction: "preview_generated",
      previewStatus:
        preview.validation?.status ?? (preview.status === "error" ? "failed" : undefined),
      botKey: bot.id,
      botCategory: bot.category,
    });
    return preview;
  };

  try {
    // 1. Re-verify the bot is still active + scoped to FinalPackStudio + eligible.
    const { data: botRow, error: botErr } = await supabase
      .from("ai_bots")
      .select("id,status,domains_allowed,allowed_block_types,current_version_id,provider_id,model")
      .eq("id", bot.id)
      .maybeSingle();

    if (botErr || !botRow) {
      return finish({ ...base, error: "This assistant is no longer available in Bot Builder." });
    }
    if (botRow.status !== "active") {
      return finish({ ...base, error: "This assistant is currently disabled in Bot Builder." });
    }
    if (!Array.isArray(botRow.domains_allowed) || !botRow.domains_allowed.includes(PDF_STUDIO_DOMAIN)) {
      return finish({ ...base, error: "This assistant is no longer enabled for FinalPackStudio." });
    }
    if (!allowsBlock(botRow.allowed_block_types, block.render_key)) {
      return finish({ ...base, error: "This assistant is not enabled for this block type." });
    }

    // 2. Fetch the linked current version (the only permitted prompt source).
    const versionId = botRow.current_version_id;
    if (!versionId) {
      return finish({ ...base, error: "This assistant has no current version in Bot Builder." });
    }
    const { data: ver, error: verErr } = await supabase
      .from("ai_bot_versions")
      .select("id,system_instruction,safety_rules,custom_instruction,temperature,max_tokens,provider_id,model")
      .eq("id", versionId)
      .maybeSingle();

    if (verErr || !ver) {
      return finish({ ...base, version_id: versionId, error: "This assistant's version was not found in Bot Builder." });
    }
    const systemInstruction = (ver.system_instruction ?? "").trim();
    if (!systemInstruction) {
      return finish({ ...base, version_id: versionId, error: "This assistant has no system instruction in Bot Builder." });
    }

    // 3. Resolve provider NAME from provider_id (generateAI takes the name).
    const providerId = ver.provider_id || botRow.provider_id;
    const providers = await fetchAIProviders();
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) {
      return finish({ ...base, version_id: versionId, error: "This assistant's AI provider is not configured." });
    }

    // 4. Compose the system prompt strictly from Bot Builder version fields.
    const systemPrompt = [systemInstruction, ver.safety_rules, ver.custom_instruction]
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .join("\n\n");

    const model = ver.model || botRow.model || provider.modelDefault;
    const temperature = typeof ver.temperature === "number" ? ver.temperature : 0.5;
    const userPrompt = buildUserPrompt(context);

    // 5. Run via the approved generateAI path. skipUsageLog: this path owns the
    //    audit row (written below via finish→logBlockAIAudit with preview_status).
    const result = await generateAI({
      provider: provider.name,
      model,
      systemPrompt,
      userPrompt,
      temperature,
      action: "fps_block_ai",
      botId: bot.id,
      botName: bot.display_name,
      skipUsageLog: true,
    });

    // 6. Validate the raw output (FPS-008-10) — pure, no second AI pass.
    const validation = validateBlockAIOutput(result.content, {
      bot_id: bot.id,
      bot_name: bot.display_name,
      bot_category: bot.category,
    });

    // 7. Return preview-only payload. NOTHING is applied to the block.
    return finish({
      ...base,
      status: "success",
      content: result.content,
      validation,
      version_id: versionId,
      provider: result.provider,
      model: result.model,
      tokens_input: result.tokensInput,
      tokens_output: result.tokensOutput,
      latency_ms: result.latencyMs,
    });
  } catch (err) {
    // Advisory only — editor/preview/export stay fully available.
    return finish({
      ...base,
      error: err instanceof Error ? err.message : "AI run failed. Your document is unchanged.",
    });
  }
}
