/**
 * useTranslateText — translates a single dynamic string via Google Translate.
 *
 * Requests from all components rendered within the same ~60 ms window are
 * automatically batched into a single API call, keeping network overhead low.
 * Results are cached in memory per language for the lifetime of the page.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';
const TRANSLATE_ENDPOINT = `${API_BASE}/translate`;
const BATCH_DELAY_MS = 60;
const MAX_BATCH = 128;

// ---------------------------------------------------------------------------
// In-memory cache: lang → originalText → translatedText
// Cleared when the user switches language (new Map is created).
// ---------------------------------------------------------------------------
const memCache = new Map<string, Map<string, string>>();

function getLangCache(lang: string): Map<string, string> {
  if (!memCache.has(lang)) memCache.set(lang, new Map());
  return memCache.get(lang)!;
}

// ---------------------------------------------------------------------------
// Pending batch queue (module-level so all hook instances share it)
// ---------------------------------------------------------------------------
type Resolver = (translated: string) => void;

let pendingTexts: string[] = [];
let pendingResolverMap: Map<string, Resolver[]> = new Map();
let batchTimer: ReturnType<typeof setTimeout> | null = null;
let activeLang = '';

function resetBatch(lang: string) {
  if (activeLang !== lang) {
    // Language changed mid-batch — discard pending work for old language
    if (batchTimer) { clearTimeout(batchTimer); batchTimer = null; }
    pendingTexts = [];
    pendingResolverMap = new Map();
    activeLang = lang;
  }
}

async function flushBatch(lang: string) {
  batchTimer = null;
  const texts = [...new Set(pendingTexts)]; // deduplicate
  const resolverMap = pendingResolverMap;
  pendingTexts = [];
  pendingResolverMap = new Map();

  if (texts.length === 0) return;

  const langCache = getLangCache(lang);
  const uncached = texts.filter((t) => !langCache.has(t));

  if (uncached.length > 0) {
    // Split into batches of MAX_BATCH if needed
    for (let i = 0; i < uncached.length; i += MAX_BATCH) {
      const chunk = uncached.slice(i, i + MAX_BATCH);
      try {
        const resp = await fetch(TRANSLATE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            texts: chunk,
            targetLanguage: lang,
            sourceLanguage: 'en',
          }),
        });
        if (resp.ok) {
          const data: { translations: string[] } = await resp.json();
          chunk.forEach((originalText, idx) => {
            langCache.set(originalText, data.translations[idx] ?? originalText);
          });
        } else {
          chunk.forEach((t) => langCache.set(t, t)); // fallback to original
        }
      } catch {
        chunk.forEach((t) => langCache.set(t, t)); // network error fallback
      }
    }
  }

  // Resolve all pending promises
  texts.forEach((originalText) => {
    const result = langCache.get(originalText) ?? originalText;
    resolverMap.get(originalText)?.forEach((resolve) => resolve(result));
  });
}

function enqueueBatchTranslation(text: string, lang: string): Promise<string> {
  return new Promise((resolve) => {
    resetBatch(lang);

    const langCache = getLangCache(lang);
    const cached = langCache.get(text);
    if (cached !== undefined) {
      resolve(cached);
      return;
    }

    pendingTexts.push(text);
    const resolvers = pendingResolverMap.get(text) ?? [];
    resolvers.push(resolve);
    pendingResolverMap.set(text, resolvers);

    if (!batchTimer) {
      batchTimer = setTimeout(() => flushBatch(lang), BATCH_DELAY_MS);
    }
  });
}

// ---------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------

/**
 * Translates a dynamic string from the current language.
 * - English: returns immediately, no API calls
 * - hi / te (static locales): still calls API since DB strings aren't in locale files
 * - All other languages: translates via Google Translate backend
 *
 * @param text  The English source text to translate. Pass `undefined` or `''` to skip.
 * @returns     The translated string (shows original while loading).
 */
export function useTranslateText(text: string | null | undefined): string {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const [translated, setTranslated] = useState<string>(text ?? '');
  const latestText = useRef(text);
  const latestLang = useRef(lang);

  const translate = useCallback(
    async (src: string, targetLang: string) => {
      if (!src) { setTranslated(''); return; }
      if (targetLang === 'en') { setTranslated(src); return; }

      // Check memory cache synchronously first
      const cached = getLangCache(targetLang).get(src);
      if (cached !== undefined) { setTranslated(cached); return; }

      // Show original while loading
      setTranslated(src);

      const result = await enqueueBatchTranslation(src, targetLang);
      // Guard against stale results if text/lang changed while awaiting
      if (latestText.current === src && latestLang.current === targetLang) {
        setTranslated(result);
      }
    },
    [],
  );

  useEffect(() => {
    latestText.current = text ?? '';
    latestLang.current = lang;
    void translate(text ?? '', lang);
  }, [text, lang, translate]);

  return translated;
}
