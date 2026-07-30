/**
 * final-pack-bots.ts
 * ──────────────────
 * FPS-008-04 — Block AI Microbot DISCOVERY service (read-only).
 *
 * Discovers the FinalPackStudio sparkle-menu bots that live in Bot Builder
 * (`ai_bots` + `ai_bot_versions`) and shapes them into a UI-ready structure.
 *
 * STRICT DOCTRINE (FPS-008):
 * - Bots live ENTIRELY in Bot Builder. Nothing here is hardcoded — no bot ids,
 *   no prompts, no fallback bots, no mock data.
 * - This module ONLY reads + shapes. It does NOT call AI, run bots, build UI,
 *   or touch bot-governance.ts / executeRuntimeInvocationFlow / generateMockOutput.
 * - Everything is NON-BLOCKING: an empty or failed discovery returns an empty,
 *   safe structure. No gates, no locks, no prisons.
 *
 * Discovery rules (live):
 *   ai_bots.status = 'active'                 (disabled/draft/archived excluded)
 *   domains_allowed includes 'pdf_studio'     (app scope)
 *   category      ← ai_bots.category
 *   display_order ← ai_bots.display_order
 *   allowed_block_types / allowed_document_intents / allowed_source_modes
 *     → empty array (or null) means "allow broadly".
 *
 * A bot is RUNNABLE (available=true) only when it has a current_version_id, a
 * linked ai_bot_versions row, and a non-empty system_instruction on that version.
 * Otherwise it is returned advisory-only (available=false + unavailable_reason).
 *
 * NOTE on the join: there are TWO foreign-key paths between ai_bots and
 * ai_bot_versions (ai_bot_versions.bot_id → ai_bots.id, and
 * ai_bots.current_version_id → ai_bot_versions.id). PostgREST embedding is
 * ambiguous across two relationships, so we read both tables explicitly and
 * resolve the current version in code.
 */

import { supabase } from "@/lib/supabase";

// ═══════════════════════════════════════════════════════════
// Constants — app scope only (this is a scope value, not a hardcoded bot)
// ═══════════════════════════════════════════════════════════

/** FinalPackStudio's Bot Builder app-scope tag in ai_bots.domains_allowed. */
export const PDF_STUDIO_DOMAIN = "pdf_studio";

const UNCATEGORISED = "Uncategorised";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

/** Filters that narrow which bots are offered for the current editing context. */
export interface BotDiscoveryContext {
  /** The block type being edited (e.g. "custom_text", "narrative"). */
  blockType?: string;
  /** The document intent / pack type (e.g. "proposal", "quotation"). */
  documentIntent?: string;
  /** The source mode of the instance ("connected" | "standalone"). */
  sourceMode?: string;
}

/** A single discovered bot, UI-ready. */
export interface DiscoveredBot {
  bot_id: string;
  bot_key: string;
  id: string;
  display_name: string;
  name: string;
  category: string;
  description: string;
  display_order: number | null;
  allowed_block_types: string[];
  allowed_document_intents: string[];
  allowed_source_modes: string[];
  provider_id: string | null;
  model: string | null;
  current_version_id: string | null;
  version_id: string | null;
  has_system_instruction: boolean;
  /** Runnable now? false = advisory only (never blocks the editor). */
  available: boolean;
  /** Why the bot is not runnable, when available=false. */
  unavailable_reason?: string;
}

/** A category group of bots for the sparkle menu. */
export interface DiscoveredBotCategory {
  category: string;
  display_order: number | null;
  bots: DiscoveredBot[];
}

/** The full shaped discovery result. */
export interface BotDiscoveryResult {
  categories: DiscoveredBotCategory[];
  totalBots: number;
  /** Bots returned but flagged not-runnable (advisory). */
  unavailableCount: number;
}

export const EMPTY_DISCOVERY: BotDiscoveryResult = {
  categories: [],
  totalBots: 0,
  unavailableCount: 0,
};

// ═══════════════════════════════════════════════════════════
// Eligibility helpers
// ═══════════════════════════════════════════════════════════

function toArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

/**
 * Empty/missing allowed-list ⇒ allow broadly. If a context value is provided
 * and the list is non-empty, the value must be present.
 */
function allows(allowed: string[], value?: string): boolean {
  if (allowed.length === 0) return true; // allow broadly
  if (value == null || value === "") return true; // no constraint to apply
  return allowed.includes(value);
}

/** Nulls sort last; then a stable secondary key is applied by the caller. */
function orderRank(order: number | null): number {
  return order == null ? Number.POSITIVE_INFINITY : order;
}

/**
 * Re-filter an already-discovered result by a specific block type, client-side.
 * Lets the page fetch bots ONCE (without a block filter) and each block narrow
 * to its own render_key without another round-trip. Empty allowed_block_types on
 * a bot ⇒ allow broadly. Recomputes category grouping + counts. Pure, no I/O.
 */
export function filterDiscoveryByBlockType(
  result: BotDiscoveryResult,
  blockType?: string,
): BotDiscoveryResult {
  const bots: DiscoveredBot[] = [];
  for (const cat of result.categories) {
    for (const bot of cat.bots) {
      if (allows(bot.allowed_block_types, blockType)) bots.push(bot);
    }
  }
  if (bots.length === 0) return EMPTY_DISCOVERY;

  const groups = new Map<string, DiscoveredBot[]>();
  for (const bot of bots) {
    const list = groups.get(bot.category) ?? [];
    list.push(bot);
    groups.set(bot.category, list);
  }
  const categories: DiscoveredBotCategory[] = [];
  for (const [category, list] of groups) {
    const categoryOrder = list.reduce<number | null>((acc, b) => {
      if (b.display_order == null) return acc;
      return acc == null ? b.display_order : Math.min(acc, b.display_order);
    }, null);
    categories.push({ category, display_order: categoryOrder, bots: list });
  }
  categories.sort((a, b) => {
    const r = orderRank(a.display_order) - orderRank(b.display_order);
    if (r !== 0) return r;
    return a.category.localeCompare(b.category);
  });

  return {
    categories,
    totalBots: bots.length,
    unavailableCount: bots.filter((b) => !b.available).length,
  };
}

// ═══════════════════════════════════════════════════════════
// Discovery
// ═══════════════════════════════════════════════════════════

/**
 * Query live Bot Builder for FinalPackStudio bots and shape them.
 * Read-only. Never throws — returns EMPTY_DISCOVERY on any failure.
 */
export async function discoverBlockAIBots(
  context: BotDiscoveryContext = {},
): Promise<BotDiscoveryResult> {
  try {
    // 1. Enabled FinalPackStudio bots.
    const { data: botRows, error: botErr } = await supabase
      .from("ai_bots")
      .select(
        "id,name,display_name,purpose,category,display_order,domains_allowed,allowed_block_types,allowed_document_intents,allowed_source_modes,provider_id,model,current_version_id,status",
      )
      .eq("status", "active")
      .contains("domains_allowed", [PDF_STUDIO_DOMAIN])
      .limit(500);

    if (botErr || !botRows || botRows.length === 0) {
      return EMPTY_DISCOVERY;
    }

    // 2. Linked current versions (only those referenced by a current_version_id).
    const versionIds = Array.from(
      new Set(
        botRows
          .map((b: any) => b.current_version_id)
          .filter((v: any): v is string => typeof v === "string" && v.length > 0),
      ),
    );

    const versionById = new Map<string, { id: string; system_instruction: string | null }>();
    if (versionIds.length > 0) {
      const { data: verRows, error: verErr } = await supabase
        .from("ai_bot_versions")
        .select("id,system_instruction")
        .in("id", versionIds);
      // Non-blocking: if versions fail to load, bots simply read as unavailable.
      if (!verErr && verRows) {
        for (const v of verRows as any[]) {
          versionById.set(String(v.id), {
            id: String(v.id),
            system_instruction: v.system_instruction ?? null,
          });
        }
      }
    }

    // 3. Shape + filter by editing context.
    const bots: DiscoveredBot[] = [];
    for (const row of botRows as any[]) {
      const allowedBlockTypes = toArray(row.allowed_block_types);
      const allowedIntents = toArray(row.allowed_document_intents);
      const allowedSourceModes = toArray(row.allowed_source_modes);

      // Context eligibility — empty arrays allow broadly.
      if (!allows(allowedBlockTypes, context.blockType)) continue;
      if (!allows(allowedIntents, context.documentIntent)) continue;
      if (!allows(allowedSourceModes, context.sourceMode)) continue;

      const currentVersionId =
        typeof row.current_version_id === "string" && row.current_version_id.length > 0
          ? row.current_version_id
          : null;
      const version = currentVersionId ? versionById.get(currentVersionId) : undefined;
      const systemInstruction = version?.system_instruction ?? "";
      const hasSystemInstruction =
        typeof systemInstruction === "string" && systemInstruction.trim().length > 0;

      // Availability (advisory; never blocks the editor).
      let available = true;
      let unavailableReason: string | undefined;
      if (!currentVersionId) {
        available = false;
        unavailableReason = "No current version linked in Bot Builder";
      } else if (!version) {
        available = false;
        unavailableReason = "Linked version not found in Bot Builder";
      } else if (!hasSystemInstruction) {
        available = false;
        unavailableReason = "Linked version has no system instruction";
      }

      const category =
        typeof row.category === "string" && row.category.trim().length > 0
          ? row.category.trim()
          : UNCATEGORISED;
      const displayOrder =
        typeof row.display_order === "number" && Number.isFinite(row.display_order)
          ? row.display_order
          : null;
      const id = String(row.id ?? "");
      const displayName =
        (typeof row.display_name === "string" && row.display_name.trim()) ||
        (typeof row.name === "string" && row.name.trim()) ||
        id ||
        "Untitled bot";

      bots.push({
        bot_id: id,
        bot_key: id,
        id,
        display_name: displayName,
        name: row.name ?? displayName,
        category,
        description: row.purpose ?? "",
        display_order: displayOrder,
        allowed_block_types: allowedBlockTypes,
        allowed_document_intents: allowedIntents,
        allowed_source_modes: allowedSourceModes,
        provider_id: row.provider_id ?? null,
        model: row.model ?? null,
        current_version_id: currentVersionId,
        version_id: version?.id ?? null,
        has_system_instruction: hasSystemInstruction,
        available,
        unavailable_reason: unavailableReason,
      });
    }

    // 4. Group into categories.
    const groups = new Map<string, DiscoveredBot[]>();
    for (const bot of bots) {
      const list = groups.get(bot.category) ?? [];
      list.push(bot);
      groups.set(bot.category, list);
    }

    const categories: DiscoveredBotCategory[] = [];
    for (const [category, list] of groups) {
      list.sort((a, b) => {
        const r = orderRank(a.display_order) - orderRank(b.display_order);
        if (r !== 0) return r;
        return a.display_name.localeCompare(b.display_name);
      });
      // Category order = smallest member display_order (nulls last).
      const categoryOrder = list.reduce<number | null>((acc, b) => {
        if (b.display_order == null) return acc;
        return acc == null ? b.display_order : Math.min(acc, b.display_order);
      }, null);
      categories.push({ category, display_order: categoryOrder, bots: list });
    }

    categories.sort((a, b) => {
      const r = orderRank(a.display_order) - orderRank(b.display_order);
      if (r !== 0) return r;
      return a.category.localeCompare(b.category);
    });

    return {
      categories,
      totalBots: bots.length,
      unavailableCount: bots.filter((b) => !b.available).length,
    };
  } catch {
    // Discovery must never throw into the editor.
    return EMPTY_DISCOVERY;
  }
}
