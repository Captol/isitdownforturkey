/// <reference types="astro/client" />

declare module '*.astro' {
  const Component: any;
  export default Component;
}

declare module '../i18n/strings' {
  export const strings: { tr: Record<string, string>; en: Record<string, string> };
  export type Lang = 'tr' | 'en';
  export function t(lang: Lang, key: string): string;
  export function detectLang(headers: Headers, url?: string): Lang;
}

declare module '../layouts/Layout.astro' {
  export default any;
}

declare module '../components/VerdictBadge.astro' {
  export default any;
}

declare module '../components/ISPGrid.astro' {
  export default any;
}
