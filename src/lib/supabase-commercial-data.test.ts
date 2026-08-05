/**
 * supabase-commercial-data.test.ts — SC-01 Wave 04 / T08-B correction pass.
 *
 * Contract under test — `readCustomerMasterById`, the read that replaced the
 * hardcoded customer object literal in pages/ProposalWorkspace.tsx
 * (`{ grade:'TBA', dso:0, paymentStatus:'Good', … }`).
 *
 *   - identity      → the row is fetched by the exact customer id, nothing else
 *   - projection    → only the columns the workspace renders are requested
 *   - honest empty  → a genuinely absent row reports "absent", never a record
 *   - functional err→ a PostgREST/RLS error reports "error", never "absent"
 *
 * The Supabase mock HONOURS THE PROJECTION and records the filters actually
 * sent, so what is asserted here is what reaches the database.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockResult = { data: unknown; error: { message: string } | null };

interface RecordedCall {
  table: string;
  projection: string | null;
  filters: Array<[string, unknown]>;
  terminal: string | null;
}

const sb = {
  calls: [] as RecordedCall[],
  results: {} as Record<string, MockResult>,
};

function applyProjection(projection: string | null, data: unknown): unknown {
  if (!projection || projection === '*' || data === null || data === undefined) return data;
  const wanted = projection.split(',').map(c => c.trim()).filter(Boolean);
  const pick = (row: any) => {
    if (row === null || typeof row !== 'object') return row;
    const picked: Record<string, any> = {};
    for (const column of wanted) if (column in row) picked[column] = row[column];
    return picked;
  };
  return Array.isArray(data) ? data.map(pick) : pick(data);
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from(table: string) {
      const call: RecordedCall = { table, projection: null, filters: [], terminal: null };
      sb.calls.push(call);
      const settle = (terminal: string) => {
        call.terminal = terminal;
        const result = sb.results[table] ?? { data: null, error: null };
        return {
          data: result.error ? null : applyProjection(call.projection, result.data),
          error: result.error,
        };
      };
      const builder: any = {
        select: (projection?: string) => { call.projection = projection ?? '*'; return builder; },
        eq: (column: string, value: unknown) => { call.filters.push([column, value]); return builder; },
        maybeSingle: () => Promise.resolve(settle('maybeSingle')),
        single: () => Promise.resolve(settle('single')),
        order: () => Promise.resolve(settle('order')),
        then: (resolve: any, reject: any) => Promise.resolve(settle('then')).then(resolve, reject),
      };
      return builder;
    },
  },
}));

import { readCustomerMasterById, CUSTOMER_MASTER_COLUMNS } from './supabase-commercial-data';

const CUSTOMER_ID = 'c0000000-0000-4000-8000-000000000001';

function customerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CUSTOMER_ID,
    code: 'KAFD-001',
    name: 'KAFD',
    industry: 'Real Estate',
    city: 'Riyadh',
    region: 'Central',
    grade: 'B',
    service_type: 'Warehousing',
    account_owner: 'Amin Al-Halabi',
    contract_expiry: '2027-01-31',
    contract_value_2025: '4200000',
    revenue_2024: '3100000',
    revenue_2025: '3800000',
    dso: 38,
    payment_status: 'Acceptable',
    // Columns the workspace does NOT render. A mock that leaked these would
    // let the page display something it never asked the database for.
    contact_phone: '+966500000000',
    internal_notes: 'do not display',
    ...overrides,
  };
}

beforeEach(() => {
  sb.calls = [];
  sb.results = {};
});

describe('readCustomerMasterById — what reaches the database', () => {
  it('queries the customers table by the exact id, once', async () => {
    sb.results.customers = { data: customerRow(), error: null };
    await readCustomerMasterById(CUSTOMER_ID);

    expect(sb.calls).toHaveLength(1);
    expect(sb.calls[0].table).toBe('customers');
    expect(sb.calls[0].filters).toEqual([['id', CUSTOMER_ID]]);
    expect(sb.calls[0].terminal).toBe('maybeSingle');
  });

  it('requests an explicit projection, not select("*")', async () => {
    sb.results.customers = { data: customerRow(), error: null };
    await readCustomerMasterById(CUSTOMER_ID);

    expect(sb.calls[0].projection).toBe(CUSTOMER_MASTER_COLUMNS);
    expect(sb.calls[0].projection).not.toBe('*');
    for (const column of ['dso', 'payment_status', 'grade', 'contract_value_2025']) {
      expect(sb.calls[0].projection).toContain(column);
    }
  });

  it('trims the id before it is sent', async () => {
    sb.results.customers = { data: customerRow(), error: null };
    await readCustomerMasterById(`  ${CUSTOMER_ID}  `);
    expect(sb.calls[0].filters).toEqual([['id', CUSTOMER_ID]]);
  });

  it('does not touch the database at all for a blank id', async () => {
    const result = await readCustomerMasterById('   ');
    expect(sb.calls).toHaveLength(0);
    expect(result).toEqual({ status: 'absent', customer: null, message: null });
  });
});

describe('readCustomerMasterById — outcomes stay distinguishable', () => {
  it('maps a stored row into the record the workspace renders', async () => {
    sb.results.customers = { data: customerRow(), error: null };
    const result = await readCustomerMasterById(CUSTOMER_ID);

    expect(result.status).toBe('found');
    expect(result.message).toBeNull();
    expect(result.customer).toEqual({
      id: CUSTOMER_ID,
      code: 'KAFD-001',
      name: 'KAFD',
      industry: 'Real Estate',
      city: 'Riyadh',
      region: 'Central',
      grade: 'B',
      serviceType: 'Warehousing',
      accountOwner: 'Amin Al-Halabi',
      contractExpiry: '2027-01-31',
      contractValue2025: 4200000,
      revenue2024: 3100000,
      revenue2025: 3800000,
      dso: 38,
      paymentStatus: 'Acceptable',
    });
  });

  it('leaves unstored columns null instead of defaulting them', async () => {
    // This is the whole point of the correction: the removed literal defaulted
    // dso to 0 and paymentStatus to 'Good', which then drove a verdict.
    sb.results.customers = {
      data: customerRow({ dso: null, payment_status: null, grade: null, contract_value_2025: null }),
      error: null,
    };
    const result = await readCustomerMasterById(CUSTOMER_ID);

    expect(result.status).toBe('found');
    expect(result.customer?.dso).toBeNull();
    expect(result.customer?.paymentStatus).toBeNull();
    expect(result.customer?.grade).toBeNull();
    expect(result.customer?.contractValue2025).toBeNull();
    expect(result.customer?.dso).not.toBe(0);
    expect(result.customer?.paymentStatus).not.toBe('Good');
  });

  it('treats an empty string column as not recorded, not as a value', async () => {
    sb.results.customers = { data: customerRow({ grade: '   ', payment_status: '' }), error: null };
    const result = await readCustomerMasterById(CUSTOMER_ID);
    expect(result.customer?.grade).toBeNull();
    expect(result.customer?.paymentStatus).toBeNull();
  });

  it('reports "absent" — not a record — when the read matched no row', async () => {
    sb.results.customers = { data: null, error: null };
    const result = await readCustomerMasterById(CUSTOMER_ID);
    expect(result).toEqual({ status: 'absent', customer: null, message: null });
  });

  it('reports "error" with the reason when the read FAILED, never "absent"', async () => {
    sb.results.customers = {
      data: null,
      error: { message: 'permission denied for table customers' },
    };
    const result = await readCustomerMasterById(CUSTOMER_ID);

    expect(result.status).toBe('error');
    expect(result.status).not.toBe('absent');
    expect(result.message).toBe('permission denied for table customers');
    expect(result.customer).toBeNull();
  });
});
