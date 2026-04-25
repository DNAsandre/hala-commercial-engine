/**
 * Quote Constants — Sprint 3
 * 
 * Centralized margin thresholds and quote configuration.
 * These are ADVISORY only — no blocking.
 */

/** Gross Profit RAG thresholds (advisory, not gates) */
export const GP_THRESHOLDS = {
  GREEN_MIN: 25,   // GP >= 25% = healthy
  AMBER_MIN: 15,   // GP >= 15% and < 25% = tight
  // GP < 15% = critical (red)
} as const;

/** Quote status values */
export const QUOTE_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUPERSEDED: 'superseded',
  EXPIRED: 'expired',
} as const;

export type QuoteStatus = typeof QUOTE_STATUS[keyof typeof QUOTE_STATUS];

/** Service types */
export const SERVICE_TYPES = [
  { value: 'warehousing', label: 'Warehousing' },
  { value: 'transport', label: 'Transport' },
  { value: 'vas', label: 'Value Added Services (VAS)' },
  { value: 'multi_service', label: 'Multi-Service' },
] as const;

export type ServiceType = typeof SERVICE_TYPES[number]['value'];

/** Volume units by service type */
export const VOLUME_UNITS: Record<string, { value: string; label: string }[]> = {
  warehousing: [
    { value: 'pallets', label: 'Pallets' },
    { value: 'sqm', label: 'Square Metres' },
  ],
  transport: [
    { value: 'trips', label: 'Trips / Month' },
    { value: 'tonnes', label: 'Tonnes' },
  ],
  vas: [
    { value: 'units', label: 'Units' },
    { value: 'orders', label: 'Orders' },
  ],
  multi_service: [
    { value: 'pallets', label: 'Pallets' },
    { value: 'trips', label: 'Trips' },
    { value: 'units', label: 'Units' },
  ],
};

/** Validity options */
export const VALIDITY_OPTIONS = [
  { value: 15, label: '15 days' },
  { value: 30, label: '30 days' },
  { value: 45, label: '45 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
];

/**
 * Calculate margin RAG status (advisory only)
 */
export function getMarginRAG(gpPercent: number): 'green' | 'amber' | 'red' {
  if (gpPercent >= GP_THRESHOLDS.GREEN_MIN) return 'green';
  if (gpPercent >= GP_THRESHOLDS.AMBER_MIN) return 'amber';
  return 'red';
}

/**
 * Calculate gross profit from revenue and cost
 */
export function calculateMargin(revenue: number, cost: number) {
  if (!revenue || revenue <= 0) {
    return { amount: 0, percent: 0, rag: 'red' as const, valid: false };
  }
  const amount = revenue - cost;
  const percent = (amount / revenue) * 100;
  return {
    amount: Math.round(amount * 100) / 100,
    percent: Math.round(percent * 10) / 10,
    rag: getMarginRAG(percent),
    valid: true,
  };
}
