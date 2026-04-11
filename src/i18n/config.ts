import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import enTranslations from './locales/en.json';
import hiTranslations from './locales/hi.json';
import teTranslations from './locales/te.json';

/**
 * Language codes that have hand-crafted locale files.
 * All other Indian languages are translated dynamically via Google Translate.
 */
export const STATIC_LOCALES = ['en', 'hi', 'te'] as const;

/**
 * All supported Indian languages (ISO 639-1 / Google Translate codes).
 * The first three have static locale files; the rest use Google Translate.
 */
export const INDIAN_LANGUAGE_CODES = [
  'en', 'hi', 'te',
  'as', 'bn', 'gu', 'kn', 'kok', 'ks', 'ml', 'mni-Mtei',
  'mr', 'ne', 'or', 'pa', 'sa', 'sat', 'sd', 'ta', 'ur',
] as const;

export type IndianLanguageCode = (typeof INDIAN_LANGUAGE_CODES)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      hi: { translation: hiTranslations },
      te: { translation: teTranslations },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;

