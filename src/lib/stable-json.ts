export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(sortStable(value)) ?? "";
}

function sortStable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortStable);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.keys(source).sort().reduce<Record<string, unknown>>((next, key) => {
      const sortedValue = sortStable(source[key]);
      if (sortedValue !== undefined) next[key] = sortedValue;
      return next;
    }, {});
  }

  return value;
}
