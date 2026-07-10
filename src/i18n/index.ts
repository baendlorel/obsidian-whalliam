import { getLanguage } from 'obsidian';
import { dict } from './dict.js';

const isZh = (lang: string): boolean => lang === 'zh' || lang === 'zh-TW';

/**
 * Translation helper. Chinese keys are returned as-is for the zh locale;
 * other locales resolve through the English dictionary in `dict.ts`.
 */
export const t = (key: keyof typeof dict, ...args: unknown[]): string => {
  let text = isZh(getLanguage()) ? (key as string) : dict[key] ?? (key as string);
  for (let i = 0; i < args.length; i += 1) {
    text = text.replace(`$${i + 1}`, String(args[i]));
  }
  return text;
};
