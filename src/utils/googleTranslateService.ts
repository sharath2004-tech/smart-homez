/**
 * Google Translate service — routes translation calls through the backend proxy
 * to keep the API key off the client. Translations are cached in localStorage
 * per language with a 7-day TTL so repeated page loads are instant.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';
const TRANSLATE_ENDPOINT = `${API_BASE}/translate`;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_BATCH = 128; // Google Translate API hard limit

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

interface CacheEntry {
  bundle: Record<string, string>;
  timestamp: number;
}

/**
 * Compute a cheap FNV-1a hash of the sorted key names in a bundle.
 * This changes whenever keys are added/removed from en.json, which forces
 * stale cached translations to be discarded and re-fetched.
 */
export function computeBundleVersion(bundle: NestedBundle): string {
  const flat = flattenBundle(bundle);
  const keys = Object.keys(flat).sort().join('|');
  let h = 2166136261; // FNV offset basis (32-bit)
  for (let i = 0; i < keys.length; i++) {
    h ^= keys.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0; // FNV prime, keep unsigned 32-bit
  }
  return h.toString(36);
}

function cacheKey(lang: string, version: string): string {
  return `gt_translations_${lang}_${version}`;
}

function readCache(lang: string, version: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(cacheKey(lang, version));
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey(lang, version));
      return null;
    }
    return entry.bundle;
  } catch {
    return null;
  }
}

function writeCache(lang: string, version: string, bundle: Record<string, string>): void {
  try {
    const entry: CacheEntry = { bundle, timestamp: Date.now() };
    localStorage.setItem(cacheKey(lang, version), JSON.stringify(entry));
  } catch {
    // Ignore storage errors (e.g. private-browsing quota)
  }
}

// ---------------------------------------------------------------------------
// Flattening / unflattening nested JSON translation bundles
// ---------------------------------------------------------------------------

type NestedBundle = { [key: string]: string | NestedBundle };

export function flattenBundle(
  obj: NestedBundle,
  prefix = '',
  result: Record<string, string> = {},
): Record<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      result[fullKey] = v;
    } else if (typeof v === 'object' && v !== null) {
      flattenBundle(v as NestedBundle, fullKey, result);
    }
  }
  return result;
}

export function unflattenBundle(flat: Record<string, string>): NestedBundle {
  const result: NestedBundle = {};
  for (const [dotKey, value] of Object.entries(flat)) {
    const parts = dotKey.split('.');
    let node = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== 'object' || node[parts[i]] === null) {
        node[parts[i]] = {};
      }
      node = node[parts[i]] as NestedBundle;
    }
    node[parts[parts.length - 1]] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Core translation API call
// ---------------------------------------------------------------------------

async function callTranslateEndpoint(
  texts: string[],
  targetLanguage: string,
): Promise<string[]> {
  const response = await fetch(TRANSLATE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, targetLanguage, sourceLanguage: 'en' }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Translation API error ${response.status}: ${body}`);
  }

  const data: { translations: string[] } = await response.json();
  return data.translations;
}

// ---------------------------------------------------------------------------
// Batch translate (handles API's per-request limit)
// ---------------------------------------------------------------------------

async function batchTranslate(texts: string[], targetLang: string): Promise<string[]> {
  const results: string[] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const chunk = texts.slice(i, i + MAX_BATCH);
    const translated = await callTranslateEndpoint(chunk, targetLang);
    results.push(...translated);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Translates an entire i18next resource bundle (nested JSON) from English
 * to the given target language. Returns the translated nested bundle.
 *
 * Results are cached in localStorage for 7 days.
 */
export async function translateBundle(
  englishBundle: NestedBundle,
  targetLang: string,
): Promise<NestedBundle> {
  const version = computeBundleVersion(englishBundle);

  // Check cache first — version-keyed so stale entries are auto-bypassed
  const cached = readCache(targetLang, version);
  if (cached) {
    return unflattenBundle(cached);
  }

  const flatEn = flattenBundle(englishBundle);
  const keys = Object.keys(flatEn);
  const values = keys.map((k) => flatEn[k]);

  const translatedValues = await batchTranslate(values, targetLang);

  const flatTranslated: Record<string, string> = {};
  keys.forEach((k, i) => {
    flatTranslated[k] = translatedValues[i] ?? flatEn[k];
  });

  writeCache(targetLang, version, flatTranslated);
  return unflattenBundle(flatTranslated);
}

/**
 * Invalidates ALL cached translations for a specific language (all versions).
 */
export function invalidateTranslationCache(lang: string): void {
  const prefix = `gt_translations_${lang}_`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) keysToRemove.push(k);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}
