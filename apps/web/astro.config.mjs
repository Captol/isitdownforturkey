import { defineConfig} from 'astro/config';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  output: 'server',
  adapter: vercel({
    runtime: 'nodejs22.x',
  }),
  site: 'https://isitdownforturkey.pages.dev',
  i18n: { defaultLocale: 'tr', locales: ['tr', 'en'] },
});
