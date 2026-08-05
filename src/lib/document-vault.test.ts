/**
 * document-vault.test.ts — SC-01 Wave 04, Fable-owned shared module.
 *
 * `DocumentViewer` resolved its preview URL through `getFileUrl()`, which
 * returns null unconditionally (the legacy in-memory Blob registry was removed
 * in Wave 02). Every document therefore rendered
 *   "This document does not have a valid file attached"
 * even when its bytes were really in Storage, and the Download button — gated
 * on the same value — never appeared at all.
 *
 * The viewer now signs the active version's real storage path. These tests pin
 * the choice of path, and the distinction the old code destroyed: "no stored
 * file" and "could not reach the stored file" are different answers.
 */
import { describe, expect, it } from "vitest";
import { getFileUrl, hasRealFile, resolveVersionFilePath } from "./document-vault";

const version = (n: number, filePath: string | null) =>
  ({ versionNumber: n, filePath, fileName: `v${n}.pdf` }) as any;

const docWith = (versions: any[], currentVersion = 1, filePath: string | null = null) =>
  ({ versions, currentVersion, filePath }) as any;

describe("resolveVersionFilePath", () => {
  it("returns the requested version's stored path", () => {
    const doc = docWith([version(1, "docs/a-v1.pdf"), version(2, "docs/a-v2.pdf")], 2);
    expect(resolveVersionFilePath(doc, 1)).toBe("docs/a-v1.pdf");
    expect(resolveVersionFilePath(doc, 2)).toBe("docs/a-v2.pdf");
  });

  it("falls back to the current version when none is requested", () => {
    const doc = docWith([version(1, "docs/a-v1.pdf"), version(2, "docs/a-v2.pdf")], 2);
    expect(resolveVersionFilePath(doc, null)).toBe("docs/a-v2.pdf");
  });

  it("falls back to the record's own filePath when versions carry none", () => {
    const doc = docWith([version(1, null)], 1, "docs/legacy.pdf");
    expect(resolveVersionFilePath(doc, 1)).toBe("docs/legacy.pdf");
  });

  it("returns null only when there genuinely is no stored file", () => {
    expect(resolveVersionFilePath(docWith([version(1, null)], 1, null), 1)).toBeNull();
    expect(resolveVersionFilePath(docWith([], 1, null), 1)).toBeNull();
    // an empty string is not a path
    expect(resolveVersionFilePath(docWith([version(1, "")], 1, ""), 1)).toBeNull();
  });

  it("resolves a path for a document that has stored bytes — the case the old viewer called 'not attached'", () => {
    const doc = docWith([version(1, "documents/kafd/quote.pdf")], 1);
    expect(hasRealFile({ ...doc, filePath: "documents/kafd/quote.pdf" } as any)).toBe(true);
    expect(resolveVersionFilePath(doc, 1)).toBe("documents/kafd/quote.pdf");
    // and the helper the viewer used to rely on still cannot produce one
    expect(getFileUrl("any-id", 1)).toBeNull();
  });
});
