import { defineConfig, loadEnv, type Connect, type HtmlTagDescriptor, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Two HTML entry points:
 *  - index.html: the static, indexable landing page served at "/".
 *  - app.html:   the React app (behind sign-in), served for every other route.
 * In production the host's SPA fallback (public/_redirects) maps unknown paths to
 * /app.html; this middleware does the same for `vite` and `vite preview`.
 */
function appShellFallback(): Plugin {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    const accept = req.headers.accept ?? '';
    const pathname = (req.url ?? '/').split('?')[0];
    const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
    const isPageRequest = req.method === 'GET' && accept.includes('text/html') && !lastSegment.includes('.');
    if (isPageRequest && pathname !== '/') req.url = '/app.html';
    next();
  };
  return {
    name: 'testdesk-app-shell-fallback',
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite),
  };
}

/**
 * SEO output that needs the public address of the site (VITE_SITE_URL):
 * canonical + og:url + og:image tags and JSON-LD on the landing page, and
 * robots.txt / sitemap.xml in the build. Without the address, only the parts
 * that are valid without it are produced, and the build prints a warning.
 */
/**
 * Inlines the landing page's small stylesheet into index.html after the build, so
 * the first paint does not wait for a second network round trip. The app's HTML
 * (app.html) is left alone: its CSS is large and cached across pages.
 */
function inlineLandingCss(): Plugin {
  return {
    name: 'testdesk-inline-landing-css',
    apply: 'build',
    writeBundle(options) {
      const dir = options.dir ?? 'dist';
      const htmlPath = path.join(dir, 'index.html');
      if (!fs.existsSync(htmlPath)) return;
      const html = fs.readFileSync(htmlPath, 'utf8');
      const link = html.match(/<link rel="stylesheet"[^>]*href="(\/assets\/landing-[^"]+\.css)"[^>]*>/);
      if (!link) return;
      const css = fs.readFileSync(path.join(dir, link[1]), 'utf8').replace(/<\/style/gi, '<\\/style');
      fs.writeFileSync(htmlPath, html.replace(link[0], () => `<style>${css}</style>`));
    },
  };
}

/** Plain text of an HTML fragment (tags removed, entities and whitespace normalised). */
function htmlText(fragment: string): string {
  return fragment
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** The FAQ questions and answers as written in the page's <section id="faq">. */
function faqFromHtml(html: string): { q: string; a: string }[] {
  const section = html.match(/<section[^>]*id="faq"[\s\S]*?<\/section>/)?.[0] ?? '';
  return Array.from(section.matchAll(/<details[\s\S]*?<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)).map(
    (m) => ({ q: htmlText(m[1]), a: htmlText(m[2]) }),
  );
}

function seo(siteUrl: string): Plugin {
  const site = siteUrl.replace(/\/+$/, '');
  const description =
    'A realistic web app for practicing test automation with Playwright, Selenium, Cypress and AI agents. Every visitor gets their own private data.';
  // Stable identifiers so the entities in the graph can reference each other.
  const id = (name: string) => `${site}/#${name}`;

  return {
    name: 'testdesk-seo',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.filename.replace(/\\/g, '/').endsWith('/index.html')) return;
        const faq = faqFromHtml(html);
        const screenshots = ['dashboard', 'tickets', 'board', 'challenges'].map((name) => `${site}/screens/${name}-1440.webp`);
        const jsonLd = {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite',
              ...(site && { '@id': id('website'), url: `${site}/` }),
              name: 'TestDesk',
              description,
              inLanguage: 'en',
            },
            {
              '@type': 'WebApplication',
              ...(site && {
                '@id': id('app'),
                url: `${site}/`,
                image: `${site}/og-image.png`,
                screenshot: screenshots,
                isPartOf: { '@id': id('website') },
              }),
              name: 'TestDesk',
              description,
              applicationCategory: 'DeveloperApplication',
              operatingSystem: 'Any (runs in a web browser)',
              browserRequirements: 'Requires JavaScript and a modern browser.',
              isAccessibleForFree: true,
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              featureList: [
                'Private data for every visitor: changes never affect other users',
                'Two-step sign-in with a one-time code',
                'New tabs and pop-up windows',
                'Native dialogs and modals',
                'File downloads and uploads',
                'Iframes and nested iframes',
                'Shadow DOM',
                'Drag and drop',
                'Infinite scroll and virtualized lists',
                'Flaky network simulation',
                'Dark mode, locales and right-to-left layout',
              ],
            },
            ...(faq.length
              ? [
                  {
                    '@type': 'FAQPage',
                    ...(site && { '@id': id('faq'), url: `${site}/#faq`, isPartOf: { '@id': id('website') } }),
                    mainEntity: faq.map(({ q, a }) => ({
                      '@type': 'Question',
                      name: q,
                      acceptedAnswer: { '@type': 'Answer', text: a },
                    })),
                  },
                ]
              : []),
          ],
        };
        const tags: HtmlTagDescriptor[] = [];
        if (site) {
          tags.push(
            { tag: 'link', attrs: { rel: 'canonical', href: `${site}/` }, injectTo: 'head' },
            { tag: 'meta', attrs: { property: 'og:url', content: `${site}/` }, injectTo: 'head' },
            { tag: 'meta', attrs: { property: 'og:image', content: `${site}/og-image.png` }, injectTo: 'head' },
            { tag: 'meta', attrs: { name: 'twitter:image', content: `${site}/og-image.png` }, injectTo: 'head' },
          );
        }
        tags.push({
          tag: 'script',
          attrs: { type: 'application/ld+json' },
          // "<" is escaped so the JSON can never close the script element.
          children: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
          injectTo: 'head',
        });
        return tags;
      },
    },
    generateBundle() {
      const sitemapLine = site ? `\nSitemap: ${site}/sitemap.xml\n` : '\n';
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        // App pages carry <meta name="robots" content="noindex">; they stay crawlable so that tag is seen.
        source: `User-agent: *\nAllow: /\n${sitemapLine}`,
      });
      if (!site) {
        this.warn('VITE_SITE_URL is not set: canonical/og:url/og:image tags and sitemap.xml were skipped.');
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          `  <url><loc>${site}/</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>1.0</priority></url>\n` +
          '</urlset>\n',
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = env.VITE_SITE_URL ?? '';

  return {
    plugins: [react(), appShellFallback(), seo(siteUrl), inlineLandingCss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 4040,
      strictPort: true,
      open: false,
    },
    preview: {
      port: 4040,
      strictPort: true,
    },
    build: {
      rollupOptions: {
        input: {
          landing: fileURLToPath(new URL('./index.html', import.meta.url)),
          app: fileURLToPath(new URL('./app.html', import.meta.url)),
        },
        output: {
          // Long-lived vendor chunks: they change far less often than app code,
          // so browsers keep them cached across deploys.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            query: ['@tanstack/react-query', 'zustand'],
            charts: ['recharts'],
          },
        },
      },
    },
  };
});
