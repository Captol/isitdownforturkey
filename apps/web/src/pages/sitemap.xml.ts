/**
 * Dynamic sitemap — indexes all tracked domains plus static pages.
 * Generated at build time by Astro. Hosted at /sitemap-index.xml.
 */
import type { APIRoute } from 'astro';

// Static pages
const staticPages = [
  { loc: '/', changefreq: 'daily' as const, priority: 1 },
  { loc: '/en/', changefreq: 'daily' as const, priority: 0.9 },
];

// Well-known Turkish service domains that are likely to be checked
const watchlistedDomains = [
  'github.com',
  'openai.com',
  'anthropic.com',
  'discord.com',
  'steamcommunity.com',
  'npmjs.com',
  'hub.docker.com',
  'huggingface.co',
  'google.com',
  'youtube.com',
  'twitter.com',
  'facebook.com',
  'instagram.com',
  'whatsapp.com',
  'tiktok.com',
  'linkedin.com',
  'amazon.com.tr',
  'trendyol.com',
  'hepsiburada.com',
  'n11.com',
  'gittigidiyor.com',
];

export const GET: APIRoute = async () => {
  const urls = [
    ...staticPages.map((p) => `  <url>\n    <loc>${p.loc}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`),
    ...watchlistedDomains.map((d) => `  <url>\n    <loc>/d/${d}</loc>\n    <changefreq>hourly</changefreq>\n    <priority>0.8</priority>\n  </url>`),
  ].join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,
    {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
};
