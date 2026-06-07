#!/usr/bin/env node

import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const siteRoot = join(__dirname, '..');
const publicDir = join(siteRoot, 'public');

const domain = 'https://sigilweaver.app';

const pages = [
  { loc: '/loom/', file: 'index.html', changefreq: 'weekly', priority: '1.0' },
  {
    loc: '/loom/downloads',
    file: 'downloads.html',
    changefreq: 'weekly',
    priority: '0.8',
  },
  {
    loc: '/loom/contributing',
    file: 'contributing.html',
    changefreq: 'monthly',
    priority: '0.5',
  },
  {
    loc: '/loom/verify-downloads',
    file: 'verify-downloads.html',
    changefreq: 'monthly',
    priority: '0.4',
  },
  { loc: '/loom/terms', file: 'terms.html', changefreq: 'yearly', priority: '0.3' },
  {
    loc: '/loom/privacy',
    file: 'privacy.html',
    changefreq: 'yearly',
    priority: '0.3',
  },
];

function toDateString(d) {
  return d.toISOString().slice(0, 10);
}

function getPageLastMod(pageFile) {
  const sourcePath = join(siteRoot, pageFile);
  const stat = statSync(sourcePath);
  return toDateString(stat.mtime);
}

function renderCoreSitemap(entries) {
  const urls = entries
    .map(
      (entry) => `  <url>\n    <loc>${domain}${entry.loc}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function renderSitemapIndex(lastmod) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap>\n    <loc>${domain}/loom/sitemap-core.xml</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>\n  <sitemap>\n    <loc>${domain}/loom/docs/sitemap.xml</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>\n</sitemapindex>\n`;
}

function main() {
  mkdirSync(publicDir, { recursive: true });

  const entries = pages.map((page) => ({
    ...page,
    lastmod: getPageLastMod(page.file),
  }));

  const latestLastMod = entries
    .map((entry) => new Date(entry.lastmod))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const indexLastMod = toDateString(latestLastMod ?? new Date());

  writeFileSync(
    join(publicDir, 'sitemap-core.xml'),
    renderCoreSitemap(entries),
    'utf8'
  );
  writeFileSync(
    join(publicDir, 'sitemap.xml'),
    renderSitemapIndex(indexLastMod),
    'utf8'
  );

  console.log('Generated public/sitemap.xml and public/sitemap-core.xml');
}

main();
