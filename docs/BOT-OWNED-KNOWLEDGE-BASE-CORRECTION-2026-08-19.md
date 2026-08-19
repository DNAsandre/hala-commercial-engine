# Bot-Owned Knowledge Base Correction

**Date:** 2026-08-19  
**Application:** `hala-clean-commercial-engine`

## Architect Ruling

Knowledge belongs to the individual bot definition. It is authored in Bot Builder and versioned with that bot. The separate Admin knowledge-collection surface is not part of the approved clean application architecture.

## Implemented

- Removed the Admin `Knowledgebase` tab and its collection dashboard.
- Replaced the Bot Builder collection picker with one pasted `Knowledge Base` text area.
- Added `public.ai_bot_versions.knowledge_base_text` as the bot-version data contract.
- Create, publish, read, and duplicate operations preserve the bot-owned knowledge text.
- Governed bot loading adds the version's knowledge text to the bot prompt under a `Knowledge Base` heading.
- New bot versions clear the obsolete `knowledge_base_ids` association field instead of creating collection links.
- Removed the clean app's orphaned collection utility and its obsolete tests.

## Data Treatment

Existing `kb_*` tables and records were not deleted or altered. They are disconnected from Admin and Bot Builder. Any physical data cleanup requires a separate, explicit record-level cleanup instruction.

## Verification

- Database migration applied successfully.
- Type-check: pass.
- Focused tests: 111 passed.
- Full tests: 692 passed.
- Production build: pass, 2,496 modules.
- Browser: Admin contains no Knowledgebase tab.
- Browser: Bot Builder contains the editable bot-owned Knowledge Base text area.
- Browser typing check used unsaved temporary text and reloaded without creating a bot or database record.

## Boundary

This correction changes bot configuration ownership. It does not add a new global knowledge library, fabricate knowledge content, or modify the old Hala application.
