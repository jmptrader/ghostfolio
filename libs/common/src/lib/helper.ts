import { Currency } from '@prisma/client';
import { getDate, getMonth, getYear, parse, subDays } from 'date-fns';

import { ghostfolioScraperApiSymbolPrefix } from './config';

const cryptocurrencies = require('cryptocurrencies');

export const DEMO_USER_ID = '9b112b4d-3b7d-4bad-9bdd-3b0f7b4dac2f';

export function capitalize(aString: string) {
  return aString.charAt(0).toUpperCase() + aString.slice(1).toLowerCase();
}

export function getBackgroundColor() {
  return getCssVariable(
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? '--dark-background'
      : '--light-background'
  );
}

export function getCssVariable(aCssVariable: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(
    aCssVariable
  );
}

export function getTextColor() {
  const cssVariable = getCssVariable(
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? '--light-primary-text'
      : '--dark-primary-text'
  );

  const [r, g, b] = cssVariable.split(',');

  return `${r}, ${g}, ${b}`;
}

export function getToday() {
  const year = getYear(new Date());
  const month = getMonth(new Date());
  const day = getDate(new Date());

  return new Date(Date.UTC(year, month, day));
}

export function getUtc(aDateString: string) {
  const [yearString, monthString, dayString] = aDateString.split('-');

  return new Date(
    Date.UTC(
      parseInt(yearString),
      parseInt(monthString) - 1,
      parseInt(dayString)
    )
  );
}

export function getYesterday() {
  const year = getYear(new Date());
  const month = getMonth(new Date());
  const day = getDate(new Date());

  return subDays(new Date(Date.UTC(year, month, day)), 1);
}

export function groupBy<T, K extends keyof T>(
  key: K,
  arr: T[]
): Map<T[K], T[]> {
  const map = new Map<T[K], T[]>();
  arr.forEach((t) => {
    if (!map.has(t[key])) {
      map.set(t[key], []);
    }
    map.get(t[key])!.push(t);
  });
  return map;
}

export function isCrypto(aSymbol = '') {
  const cryptocurrencySymbol = aSymbol.substring(0, aSymbol.length - 3);

  return cryptocurrencies.symbols().includes(cryptocurrencySymbol);
}

export function isCurrency(aSymbol = '') {
  return (
    (aSymbol.includes(Currency.CHF) ||
      aSymbol.includes(Currency.EUR) ||
      aSymbol.includes(Currency.USD)) &&
    aSymbol.length >= 6
  );
}

export function isGhostfolioScraperApiSymbol(aSymbol = '') {
  return aSymbol.startsWith(ghostfolioScraperApiSymbolPrefix);
}

export function isRakutenRapidApiSymbol(aSymbol = '') {
  return aSymbol === 'GF.FEAR_AND_GREED_INDEX';
}

export function parseCurrency(aString: string): Currency {
  if (aString?.toLowerCase() === 'chf') {
    return Currency.CHF;
  } else if (aString?.toLowerCase() === 'eur') {
    return Currency.EUR;
  } else if (aString?.toLowerCase() === 'gbp') {
    return Currency.GBP;
  } else if (aString?.toLowerCase() === 'usd') {
    return Currency.USD;
  }

  return undefined;
}

export function resetHours(aDate: Date) {
  const year = getYear(aDate);
  const month = getMonth(aDate);
  const day = getDate(aDate);

  return new Date(Date.UTC(year, month, day));
}

export function resolveFearAndGreedIndex(aValue: number) {
  if (aValue <= 25) {
    return { emoji: '🥵', text: 'Extreme Fear' };
  } else if (aValue <= 45) {
    return { emoji: '😨', text: 'Fear' };
  } else if (aValue <= 55) {
    return { emoji: '😐', text: 'Neutral' };
  } else if (aValue < 75) {
    return { emoji: '😜', text: 'Greed' };
  } else if (aValue >= 75) {
    return { emoji: '🤪', text: 'Extreme Greed' };
  }
}

export const DATE_FORMAT = 'yyyy-MM-dd';

export function parseDate(date: string) {
  return parse(date, DATE_FORMAT, new Date());
}
