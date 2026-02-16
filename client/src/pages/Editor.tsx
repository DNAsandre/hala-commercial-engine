/*
 * Editor Page — Standalone route for the Three-Mode Commercial Editor
 * Accessible from /editor or from within workspace detail
 */

import CommercialEditor from "@/components/CommercialEditor";

export default function Editor() {
  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <CommercialEditor
        documentTitle="Commercial Proposal"
        onSave={(sections) => {
          console.log("Saved sections:", sections);
        }}
      />
    </div>
  );
}
