/**
 * Canonical JSON serializer for deterministic hashing.
 * Sorts all object keys alphabetically, ignores undefined fields, and normalizes formatting.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === undefined) {
    return 'null';
  }

  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }

  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort();

  const entries = keys.map((key) => {
    return JSON.stringify(key) + ':' + canonicalJson(record[key]);
  });

  return '{' + entries.join(',') + '}';
}
