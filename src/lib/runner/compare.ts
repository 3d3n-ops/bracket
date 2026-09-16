/** Deep-equality used by the test harness (both workers import this). */

function canonical(v: unknown, unordered: boolean): unknown {
  if (Array.isArray(v)) {
    const items = v.map((x) => canonical(x, unordered));
    if (unordered) items.sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
    return items;
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(o)
        .sort()
        .map((k) => [k, canonical(o[k], unordered)]),
    );
  }
  if (typeof v === "number" && Number.isNaN(v)) return "NaN";
  return v;
}

export function deepEqual(a: unknown, b: unknown, unordered = false): boolean {
  return JSON.stringify(canonical(a, unordered)) === JSON.stringify(canonical(b, unordered));
}
