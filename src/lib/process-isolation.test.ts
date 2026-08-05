/**
 * process-isolation.test.ts — SC-01 Wave 05, Fable-owned.
 *
 * Pins the ARCHITECT'S OPTION B RULING (2026-08-05): a tender created by the
 * clean application must be admitted immediately via the established
 * `created_from_intake` marker; the exact legacy seed ids stay excluded; the
 * ratified Linde allowlist stays intact; and an id-only check may reject only
 * the exact seed ids — never an unrecognised id — because the clean-origin
 * marker lives on the row, which must therefore be read before any refusal.
 *
 * The defect this replaces (SX-012): `hasNonCanonicalId` rejected every
 * canonical UUID outside a one-entry allowlist before anything else could run,
 * so a human-created tender was written to the database and then never
 * appeared in any list and could not be opened.
 */
import { describe, expect, it } from "vitest";
import {
  ALLOWED_TENDER_IDS,
  LEGACY_SEED_TENDER_IDS,
  filterAllowedTenderTickets,
  isAllowedProposalTicket,
  isAllowedTenderTicket,
  mayTenderIdBeAllowed,
} from "./process-isolation";

const LINDE = ALLOWED_TENDER_IDS[0];
const CLEAN_CREATED = "b7e2c9d4-1234-4abc-9def-000000000001"; // arbitrary fresh UUID

const tender = (over: Record<string, unknown> = {}) => ({
  id: CLEAN_CREATED,
  ticket_type: "tender",
  ticket_title: "New Riyadh Warehousing Tender",
  customer_name: "Fresh Customer Co",
  active: true,
  ...over,
});

describe("Option B — clean-created tenders are admitted", () => {
  it("admits a fresh tender whose row carries created_from_intake=true", () => {
    expect(isAllowedTenderTicket(tender({ created_from_intake: true }))).toBe(true);
  });

  it("admits it regardless of lineage status — lineage is audit, not a gate", () => {
    expect(
      isAllowedTenderTicket(tender({ created_from_intake: true, lineage_status: "unverified" })),
    ).toBe(true);
  });

  it("keeps the ratified Linde admission intact", () => {
    expect(isAllowedTenderTicket({ id: LINDE, ticket_type: "tender" })).toBe(true);
  });

  it("does not admit via a truthy-but-not-true marker (no coercion)", () => {
    expect(isAllowedTenderTicket(tender({ created_from_intake: "true" }))).toBe(false);
    expect(isAllowedTenderTicket(tender({ created_from_intake: 1 }))).toBe(false);
  });
});

describe("Option B — legacy seeds stay excluded, by exact id only", () => {
  it.each(LEGACY_SEED_TENDER_IDS.map((id) => [id]))(
    "excludes seed %s even though its row carries created_from_intake=true",
    (id) => {
      // Live fact: all three seeds DO carry the marker, so the id is the only
      // established truth that separates them.
      expect(isAllowedTenderTicket(tender({ id, created_from_intake: true }))).toBe(false);
    },
  );

  it("never treats an unlisted id as a seed — no prefix or pattern matching", () => {
    // Same a11/a12-style prefix as the seeds, but not a captured seed id.
    const lookalike = "a1200000-0000-4000-8000-00000000ffff";
    expect(mayTenderIdBeAllowed(lookalike)).toBe(true);
    expect(isAllowedTenderTicket(tender({ id: lookalike, created_from_intake: true }))).toBe(true);
  });
});

describe("Option B — id-only checks may not reject before the row is read", () => {
  it("mayTenderIdBeAllowed rejects exactly the seed ids and nothing else", () => {
    for (const id of LEGACY_SEED_TENDER_IDS) expect(mayTenderIdBeAllowed(id)).toBe(false);
    expect(mayTenderIdBeAllowed(LINDE)).toBe(true);
    expect(mayTenderIdBeAllowed(CLEAN_CREATED)).toBe(true);
  });

  it("a fresh UUID with no row context is not admitted by the row filter alone — the row must be fetched", () => {
    // This is why the deep link calls mayTenderIdBeAllowed() first and
    // evaluates isAllowedTenderTicket() only on the fetched row.
    expect(isAllowedTenderTicket({ id: CLEAN_CREATED, ticket_type: "tender" })).toBe(false);
    expect(mayTenderIdBeAllowed(CLEAN_CREATED)).toBe(true);
  });
});

describe("Option B — the surrounding contract is unchanged", () => {
  it("filterAllowedTenderTickets keeps Linde + clean-created, drops the three seeds", () => {
    const rows = [
      tender({ id: LINDE, ticket_title: "Linde SIGAS Bulk Transportation Tender" }),
      ...LEGACY_SEED_TENDER_IDS.map((id) => tender({ id, created_from_intake: true })),
      tender({ id: CLEAN_CREATED, created_from_intake: true }),
    ];
    expect(filterAllowedTenderTickets(rows).map((r) => r.id)).toEqual([LINDE, CLEAN_CREATED]);
  });

  it("a non-tender row is still refused by the tender filter", () => {
    expect(isAllowedTenderTicket(tender({ ticket_type: "proposal", created_from_intake: true }))).toBe(false);
  });

  it("proposal admission is untouched by the ruling", () => {
    expect(
      isAllowedProposalTicket({
        id: "089447d6-6d4f-4921-9df3-92483f36233a",
        ticket_type: "proposal",
        active: true,
        source_type: "manual_verified",
      }),
    ).toBe(true);
  });
});
