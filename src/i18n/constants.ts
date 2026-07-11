/**
 * i18n Constants and Utilities
 *
 * Centralized constants for language management and UI display
 */

import type { Locale } from './types';

/**
 * Supported locales with metadata
 */
export interface LocaleInfo {
  code: Locale;
  name: string;           // Native name
  englishName: string;    // English name
  flag?: string;          // Optional flag emoji
}

/**
 * All supported locales with display information
 */
export const SUPPORTED_LOCALES: LocaleInfo[] = [
  { code: 'en', name: 'English', englishName: 'English', flag: '🇺🇸' },
  { code: 'zh-CN', name: '简体中文', englishName: 'Simplified Chinese', flag: '🇨🇳' },
  { code: 'zh-CN', name: '繁體中文', englishName: 'Traditional Chinese', flag: '🇹🇼' },
];

/**
 * Default locale
 */
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Get locale info by code
 */
export function getLocaleInfo(code: Locale): LocaleInfo | undefined {
  return SUPPORTED_LOCALES.find(locale => locale.code === code);
}

/**
 * Get display string for locale (with optional flag)
 */
export function getLocaleDisplayString(code: Locale, includeFlag = true): string {
  const info = getLocaleInfo(code);
  if (!info) return code;

  return includeFlag && info.flag
    ? `${info.flag} ${info.name} (${info.englishName})`
    : `${info.name} (${info.englishName})`;
}

