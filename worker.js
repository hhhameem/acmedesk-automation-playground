/**
 * Cloudflare Worker: app-shell fallback.
 *
 * Static files in dist/ are served directly and never reach this code ("/" is the
 * landing page, index.html). The Worker only runs when no file matches the request:
 * page requests (no file extension) get the React app (app.html, served at "/app"),
 * anything else, such as a missing script or image, stays a 404.
 * Same rule as the dev/preview middleware in vite.config.ts.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const lastSegment = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
    const isPageRequest = (request.method === 'GET' || request.method === 'HEAD') && !lastSegment.includes('.');
    if (!isPageRequest) return env.ASSETS.fetch(request);

    const shell = await env.ASSETS.fetch(new Request(new URL('/app', url), request));
    // _headers rules are not applied to responses produced by Worker code, so repeat
    // the site-wide ones from public/_headers here.
    const response = new Response(shell.body, shell);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return response;
  },
};
