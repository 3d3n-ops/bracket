/**
 * Deep-equality used by the test harness. Self-contained on purpose: the
 * server-side runner embeds `deepEqual.toString()` into a worker script.
 */
export function deepEqual(a: unknown, b: unknown, unordered = false): boolean {
  const canonical = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      const items = v.map(canonical);
      if (unordered) items.sort((x, y) => (JSON.stringify(x) < JSON.stringify(y) ? -1 : 1));
      return items;
    }
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return Object.fromEntries(
        Object.keys(o)
          .sort()
          .map((k) => [k, canonical(o[k])]),
      );
    }
    if (typeof v === "number" && Number.isNaN(v)) return "NaN";
    return v;
  };
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/**
 * Same algorithm as plain JS source, for embedding into worker scripts
 * (bundlers rewrite `fn.toString()` output with helpers like `__name`).
 */
export const DEEP_EQUAL_SRC = `
function deepEqual(a, b, unordered) {
  const canonical = (v) => {
    if (Array.isArray(v)) {
      const items = v.map(canonical);
      if (unordered) items.sort((x, y) => (JSON.stringify(x) < JSON.stringify(y) ? -1 : 1));
      return items;
    }
    if (v && typeof v === "object") {
      const o = {};
      for (const k of Object.keys(v).sort()) o[k] = canonical(v[k]);
      return o;
    }
    if (typeof v === "number" && Number.isNaN(v)) return "NaN";
    return v;
  };
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
`;
