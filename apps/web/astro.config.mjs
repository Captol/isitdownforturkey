import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  adapter: cloudflare(),
  site: 'https://isitdownforturkey.pages.dev',
  i18n: { defaultLocale: 'tr', locales: ['tr', 'en'] },
});
