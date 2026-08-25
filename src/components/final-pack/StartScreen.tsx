/**
 * StartScreen.tsx
 * ───────────────
 * FPS-001-06 — Real FinalPackStudio landing screen for /pdf-studio.
 *
 * Replaces the implicit commercial-ticket picker assumption with a proper
 * document-studio entry point. Pure navigation UI — it does not create
 * instances itself; it tells the parent which entry the user chose.
 *
 * No gates, no locks. Every option leads to an editable, exportable document.
 */

import { Link2, FilePlus, LayoutTemplate, FolderOpen, LibraryBig } from "lucide-react";

export type EntryChoice = "connected" | "blank" | "template" | "resume" | "authoring";

interface StartScreenProps {
  onChoose: (choice: EntryChoice) => void;
}

interface EntryOption {
  choice: EntryChoice;
  label: string;
  description: string;
  icon: typeof Link2;
}

const OPTIONS: EntryOption[] = [
  {
    choice: "connected",
    label: "Open Connected Tender",
    description: "Build from a live tender. For proposals, open Final Pack Studio from the proposal workspace.",
    icon: Link2,
  },
  {
    choice: "blank",
    label: "Start Blank",
    description: "Create a new document from scratch — no source required.",
    icon: FilePlus,
  },
  {
    choice: "template",
    label: "Start From Template",
    description: "Create a standalone document from an existing template.",
    icon: LayoutTemplate,
  },
  {
    choice: "resume",
    label: "Resume Existing Document",
    description: "Reopen a document you previously created.",
    icon: FolderOpen,
  },
  {
    choice: "authoring",
    label: "Template Library",
    description: "Create, clone, edit, version, publish, and retire templates.",
    icon: LibraryBig,
  },
];

export default function StartScreen({ onChoose }: StartScreenProps) {
  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2 py-6">
          <h2 className="text-xl font-semibold text-foreground">
            Final Pack Studio
          </h2>
          <p className="text-sm text-muted-foreground">
            Create a new document or resume an existing one.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.choice}
                onClick={() => onChoose(opt.choice)}
                className="flex items-start gap-3 px-5 py-4 rounded-lg border border-border bg-card text-left transition-all hover:border-primary/40 hover:shadow-sm"
              >
                <div className="p-2 rounded-md bg-accent/60">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {opt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
