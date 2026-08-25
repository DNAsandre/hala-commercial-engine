import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { OutputBlock, BlockContent } from "@/lib/final-pack-loader";
import type { BotDiscoveryResult, DiscoveredBot } from "@/lib/final-pack-bots";
import type { BlockAIDocContext } from "@/lib/final-pack-bot-context";
import BlockCard from "./BlockCard";

interface BlockCanvasProps {
  blocks: OutputBlock[];
  onMoveBlock: (fromIndex: number, toIndex: number) => void;
  onToggleVisibility: (blockId: string) => void;
  onContentChange: (blockId: string, content: Partial<BlockContent>) => void;
  onSaveReusable?: (block: OutputBlock) => void;
  onDuplicate?: (block: OutputBlock) => void;
  /** Remove a non-required block (FPS-010) — e.g. a page break. Undoable. */
  onRemove?: (block: OutputBlock) => void;
  /**
   * PADW T06c (PDS-10): per-card reset-from-source — resets THIS block.
   * (The old toolbar item claimed "selected block" but always reset blocks[0].)
   */
  onResetFromSource?: (block: OutputBlock) => void;
  renderEditor?: (block: OutputBlock, onContentChange: (c: Partial<BlockContent>) => void) => ReactNode;
  /** Discovered Bot Builder microbots for the document (FPS-008). */
  aiBots?: BotDiscoveryResult;
  aiBotsLoading?: boolean;
  onSelectBot?: (bot: DiscoveredBot, block: OutputBlock) => void;
  /** Document framing for the AI context assembler (FPS-008-08). */
  aiDocContext?: BlockAIDocContext;
}

export default function BlockCanvas({
  blocks,
  onMoveBlock,
  onToggleVisibility,
  onContentChange,
  onSaveReusable,
  onDuplicate,
  onRemove,
  onResetFromSource,
  renderEditor,
  aiBots,
  aiBotsLoading,
  onSelectBot,
  aiDocContext,
}: BlockCanvasProps) {
  return (
    <div className="fps-canvas space-y-2">
      {blocks.map((block, index) => (
        <div key={block.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <BlockCard
            block={block}
            onToggleVisibility={() => onToggleVisibility(block.id)}
            onContentChange={(content) => onContentChange(block.id, content)}
            onSaveReusable={onSaveReusable ? () => onSaveReusable(block) : undefined}
            onDuplicate={onDuplicate ? () => onDuplicate(block) : undefined}
            onRemove={onRemove && !block.required ? () => onRemove(block) : undefined}
            onResetFromSource={onResetFromSource ? () => onResetFromSource(block) : undefined}
            renderEditor={renderEditor}
            aiBots={aiBots}
            aiBotsLoading={aiBotsLoading}
            onSelectBot={onSelectBot}
            docContext={aiDocContext}
          />
          <div className="flex flex-col gap-1 pt-2">
            <button
              type="button"
              className="rounded border border-border p-1 text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
              disabled={index === 0}
              title="Move block up"
              aria-label={`Move ${block.display_name} up`}
              onClick={() => onMoveBlock(index, index - 1)}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="rounded border border-border p-1 text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
              disabled={index === blocks.length - 1}
              title="Move block down"
              aria-label={`Move ${block.display_name} down`}
              onClick={() => onMoveBlock(index, index + 1)}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}

      {blocks.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No blocks in this document pack.
        </div>
      )}
    </div>
  );
}
