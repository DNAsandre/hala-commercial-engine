# Functional Closure Data Cleanup

Date: 2026-08-19

Authorization: `DATA BABY DATA`

The cleanup migration deletes only exact, inspected IDs. It does not use text matching, prefixes, dates, or broad conditions.

## Removed

- Four `[HALA-UAT-ARV2]` commercial tickets and their two audit rows.
- The single synthetic Meridian UAT customer after confirming it had no non-ticket dependent records.
- The explicit UAT Final Pack instance and template.
- One Claude verification blank, two empty untitled blanks, three superseded Linde pack instances, and one duplicate Full Commercial Proposal instance.
- Two superseded draft `Standard Tender Proposal` templates, retaining `tpl-97ac44d7` as the latest of the three.
- The `Claude Authored Template`, which had no instance references.

## Preserved

- Linde tender `7483c493-0098-40a9-9e5f-76007bc62cd1` and latest edited pack `3a714c21-b1df-4a75-a6b2-9c85a59d7264`.
- KAFD proposal `089447d6-6d4f-4921-9df3-92483f36233a` and its existing pack.
- All published system templates.
- `tpl-97ac44d7`, the latest of the three duplicate draft tender templates.
- All records that were not individually inspected and named in the migration.

Pre-delete checks found zero compiled documents, instance versions, or vault assets attached to the selected document instances. Template-version references were zero except for the UAT template, whose sole instance was part of the same deletion set.

## Final Pack UAT Branding Follow-up

Browser UAT found one remaining `[HALA-UAT-ARV2] Standard Brand` option. It
referenced only compiled output `dco-1787129933997-8035wp`, an August 19 UAT
export for the already-removed Meridian test pack. The output had no file asset
and the brand had no live instance, template, asset, or legacy-output reference.

Migration `202608190003_functional_closure_pdf_uat_cleanup.sql` removes those
two exact UAT rows and fails if either postcondition is not met.
