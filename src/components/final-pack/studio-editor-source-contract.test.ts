import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../..");
const read = (path: string) => readFileSync(resolve(src, path), "utf8");

describe("Final Pack Studio source-level usability contracts", () => {
  it("uses the app layout slot and preserves true A4 preview geometry", () => {
    const page = read("pages/PdfStudio.tsx");
    const css = read("styles/final-pack-tokens.css");
    expect(page).not.toContain('mode === "compose" ? "h-screen"');
    expect(page).toContain('mode === "compose" ? "h-full"');
    expect(css).toMatch(/\.fps-preview-iframe[\s\S]*?flex-shrink:\s*0/);
    expect(css).toContain("@media (max-width: 900px)");
  });

  it("validates the connected route kind and removes false controls", () => {
    const selector = read("components/final-pack/PackSelector.tsx");
    const card = read("components/final-pack/BlockCard.tsx");
    const cover = read("components/final-pack/blocks/CoverEditor.tsx");
    expect(selector).toContain('.eq("ticket_type", sourceKind)');
    expect(card).not.toContain("GripVertical");
    expect(cover).not.toContain('["image", "Image cover"]');
  });

  it("does not invent a UUID reference or today's date for customer covers", () => {
    const loader = read("lib/final-pack-loader.ts");
    expect(loader).not.toContain("String(tender.id).slice(0, 8)");
    expect(loader).not.toContain('new Date().toLocaleDateString("en-GB")');
  });
});
