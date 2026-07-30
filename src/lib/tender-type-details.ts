export type TenderTypeDetails = Record<string, any>;

export function isTenderTypeDetailsRecord(value: unknown): value is TenderTypeDetails {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneTenderTypeDetails(value: unknown): TenderTypeDetails | undefined {
  return isTenderTypeDetailsRecord(value) ? { ...value } : undefined;
}

export function normalizeTenderTypeDetails(raw: unknown): TenderTypeDetails {
  const details: TenderTypeDetails = isTenderTypeDetailsRecord(raw) ? { ...raw } : {};

  const aliasIfMissing = (legacyKey: string, canonicalKey: string) => {
    if (details[canonicalKey] === undefined && isTenderTypeDetailsRecord(details[legacyKey])) {
      details[canonicalKey] = details[legacyKey];
    }
  };

  aliasIfMissing("submitted", "submission");
  aliasIfMissing("negotiation", "negotiation_data");
  aliasIfMissing("awarded", "awarded_data");
  aliasIfMissing("lost_withdrawn", "lost_withdrawn_data");

  const currentClientEvaluation = cloneTenderTypeDetails(details.client_evaluation);
  if (currentClientEvaluation) {
    let changed = false;
    if (currentClientEvaluation.legacy_technical_review === undefined && details.technical_review !== undefined) {
      currentClientEvaluation.legacy_technical_review = cloneTenderTypeDetails(details.technical_review) ?? details.technical_review;
      changed = true;
    }
    if (currentClientEvaluation.legacy_commercial_review === undefined && details.commercial_review !== undefined) {
      currentClientEvaluation.legacy_commercial_review = cloneTenderTypeDetails(details.commercial_review) ?? details.commercial_review;
      changed = true;
    }
    if (changed) details.client_evaluation = currentClientEvaluation;
  } else if (details.client_evaluation === undefined && (details.technical_review !== undefined || details.commercial_review !== undefined)) {
    details.client_evaluation = {
      ...(details.technical_review !== undefined
        ? { legacy_technical_review: cloneTenderTypeDetails(details.technical_review) ?? details.technical_review }
        : {}),
      ...(details.commercial_review !== undefined
        ? { legacy_commercial_review: cloneTenderTypeDetails(details.commercial_review) ?? details.commercial_review }
        : {}),
    };
  }

  return details;
}
