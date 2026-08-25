import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../pages/PdfStudio.tsx", import.meta.url), "utf8");

describe("Final Pack export revision seam", () => {
  it("guards lifecycle persistence by exact id and the editor's current revision", () => {
    const start = source.indexOf("const persistExportStatus");
    const end = source.indexOf("const renderExportToolbar", start);
    const contract = source.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(contract).toContain('.eq("id", expectedInstanceId)');
    expect(contract).toContain('.eq("updated_at", expectedRevision)');
    expect(contract).toContain('.select("id,status,updated_at")');
    expect(contract).toContain("rows.length !== 1");
  });

  it("advances the editor token and active row before the next guarded save", () => {
    const statusStart = source.indexOf("const persistExportStatus");
    const statusEnd = source.indexOf("const renderExportToolbar", statusStart);
    const contract = source.slice(statusStart, statusEnd);
    const tokenAdvance = contract.indexOf("lastUpdatedAtRef.current = confirmed.updated_at");
    const localAdvance = contract.indexOf("updated_at: confirmed.updated_at");
    expect(tokenAdvance).toBeGreaterThan(-1);
    expect(localAdvance).toBeGreaterThan(tokenAdvance);

    const saveStart = source.indexOf("const saveBlocks");
    const saveEnd = source.indexOf("// Block manipulation hook", saveStart);
    const saveContract = source.slice(saveStart, saveEnd);
    expect(saveContract).toContain('.eq("updated_at", lastUpdatedAtRef.current)');
  });

  it("keeps the export engine out of doc_instances revision ownership", () => {
    const exportSource = readFileSync(new URL("./final-pack-export.ts", import.meta.url), "utf8");
    expect(exportSource).not.toContain('.from("doc_instances").update');
    expect(exportSource).not.toContain("persistInstanceStatus(");
  });

  it("uses one explicit mode for preview, Print, HTML and volume export", () => {
    const toolbar = readFileSync(new URL("../components/final-pack/ExportToolbar.tsx", import.meta.url), "utf8");
    expect(source).toContain('const [previewMode, setPreviewMode] = useState<ExportMode>("draft")');
    expect(source).toContain("exportMode={previewMode}");
    expect(source).toContain("previewMode={previewMode}");
    expect(toolbar).toContain('exportMode: previewMode');
    expect(toolbar).toContain('handleExport("print", previewMode)');
    expect(toolbar).toContain('handleExport("html", previewMode)');
  });
});
