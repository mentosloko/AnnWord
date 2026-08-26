import type { ViewState } from '../types';
import { getEntryPathFromPathname } from './clientEntryPath';

const SITE_ORIGIN = 'https://annword.ru';

const ROUTE_TITLES: Partial<Record<ViewState, string>> = {
  profile: 'Прогресс и аккаунт — AnnWord',
  setup: 'Выбор игры и слов — AnnWord',
  game: 'Классика — AnnWord',
  review: 'Повторение слов — AnnWord',
  anagrams: 'Анаграммы — AnnWord',
  translation: '1 из 2 — AnnWord',
  sprint: 'Спринт — AnnWord',
  hangman: 'Виселица — AnnWord',
  memory: 'Память — AnnWord',
  letter_square: 'Змейка — AnnWord',
  shop: 'Магазин — AnnWord',
  pet_room: 'Комната питомца — AnnWord',
  account_mode_setup: 'Настройка аккаунта — AnnWord',
  character_onboarding: 'Выбор питомца — AnnWord',
  family_setup: 'Настройка ребёнка — AnnWord',
  admin: 'Админ-панель — AnnWord',
  adult_room: 'Рабочий кабинет — AnnWord',
  dictionary_settings: 'Выбор словаря — AnnWord',
  dictionary_studio: 'Редактор словаря — AnnWord',
  premium: 'AnnWord Premium',
  premium_success: 'Premium подключён — AnnWord',
};

const landingTitle = (): string => {
  if (typeof window === 'undefined') return 'AnnWord — школьные английские слова играючи';
  const entry = getEntryPathFromPathname(window.location.pathname);
  if (entry === 'kids') return 'AnnWord Kids — школьные английские слова играючи';
  if (entry === 'teacher') return 'AnnWord для преподавателей английского';
  if (entry === 'practice') return 'AnnWord Practice — тренировка английских слов';
  return 'AnnWord — школьные английские слова играючи';
};

const canonicalPath = (): string => {
  if (typeof window === 'undefined') return '/';
  const entry = getEntryPathFromPathname(window.location.pathname);
  if (entry === 'kids') return '/kids/';
  if (entry === 'teacher') return '/teacher/';
  if (entry === 'practice') return '/practice/';
  return '/';
};

const setMeta = (selector: string, attribute: 'content' | 'href', value: string): void => {
  if (typeof document === 'undefined') return;
  const node = document.querySelector<HTMLElement>(selector);
  if (node) node.setAttribute(attribute, value);
};

export const applyPageMetadata = (route: ViewState): void => {
  if (typeof document === 'undefined') return;
  const title = route === 'landing' ? landingTitle() : ROUTE_TITLES[route] || 'AnnWord';
  document.title = title;
  setMeta('meta[property="og:title"]', 'content', title);
  setMeta('meta[name="twitter:title"]', 'content', title);

  const publicRoute = route === 'landing';
  const canonical = `${SITE_ORIGIN}${publicRoute ? canonicalPath() : '/'}`;
  setMeta('link[rel="canonical"]', 'href', canonical);
  setMeta('meta[property="og:url"]', 'content', canonical);

  const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (robots) robots.content = publicRoute ? 'index,follow' : 'noindex,nofollow';
};

export const applyNotFoundMetadata = (): void => {
  if (typeof document === 'undefined') return;
  document.title = 'Страница не найдена — AnnWord';
  const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (robots) robots.content = 'noindex,nofollow';
};
