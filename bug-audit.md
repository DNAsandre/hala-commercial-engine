# Bug Audit Notes

## Current URL in Output Studio:
/composer/di-auto-c48315d7-e364-4eaf-b4da-0a5e454bdb88/view?from=editor

## Back to Editor button:
- There are TWO "Back to Editor" buttons (index 15 in header, index 31 in sidebar)
- Need to check where they navigate to

## Document ID: di-auto-c48315d7-e364-4eaf-b4da-0a5e454bdb88
## Workspace: w4 (Al-Rajhi Steel)

## Bug 1: Back to Editor navigation
- Output Studio URL: /composer/{docId}/view?from=editor
- "Back to Editor" navigates to: /editor?instance={docId}
- This goes to the LEGACY Document Composer page, NOT the workspace editor
- SHOULD navigate to: /workspaces/{workspaceId} with documents tab active
- Need to pass workspaceId through the URL or from the document instance data

## Bug 2: Delete button for drafts
- Documents tab shows quotes/proposals/SLAs with Draft status
- No delete button visible on any draft document
- Need to add delete button with confirmation dialog

## Bug 3: Compile view content quality
- Cover page: Shows "Al-Rajhi Steel — quote" with dark gradient - OK
- Confidentiality Statement: Shows generic text, not editor content
- Introduction: Shows generic "Executive Summary" text, not what user typed in editor
- The Output Studio uses pdf-renderer.ts which has HARDCODED sample content
- It does NOT pull the actual block content from the document editor
- MUST read the document instance blocks and inject their content into the PDF pages
