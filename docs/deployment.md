# Static deployment

The Astro build pre-renders every page into `dist/`. A lesson such as
`/learn/authorization-code-pkce/` has its own
`dist/learn/authorization-code-pkce/index.html`. Serve the directory indexes
and use `404.html` for missing pages. An SPA rewrite to the homepage would
hide missing pages. The build emits client assets, the sitemap, and
`robots.txt`. The canonical origin is `https://oauth.how`.

## Cloudflare Pages with GitHub

In Cloudflare, open **Workers & Pages**, select **Create application**,
then choose **Pages** and **Import an existing Git repository**. Connect
GitHub, select `oauth-how/oauth.how`, and select **Begin setup**.
[Cloudflare Pages Astro guide](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/)

| Setting                | Value                                                                        |
| ---------------------- | ---------------------------------------------------------------------------- |
| Production branch      | `main`                                                                       |
| Framework preset       | Astro                                                                        |
| Root directory         | Repository root (leave blank)                                                |
| Build command          | `npm run build`                                                              |
| Build output directory | `dist`                                                                       |
| Build image            | Version 3                                                                    |
| Node.js version        | `24.21.0` from `.nvmrc`, or set `NODE_VERSION=24.21.0` for both environments |
| Build environment      | `ASTRO_TELEMETRY_DISABLED=1` for both environments                           |

Select **Save and Deploy** once the site commits are on the production
branch. With `main` as production, use `develop` for previews until the
site is ready to merge.

Under **Settings → Builds & deployments**, set the preview branch
control to **All non-Production branches**, or include your pull-request
branches in a custom rule. Pull requests from branches in the connected
repository get preview URLs and checks. For a fork contribution, a
maintainer can create a branch in the connected repository after reviewing
the changes. Cloudflare generates previews through its Git integration.
The repository's GitHub Actions workflow runs verification independently.
[Branch deployment controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/) ·
[Preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/) ·
[Build image configuration](https://developers.cloudflare.com/pages/configuration/build-image/)

Add `oauth.how` as a custom domain in the Pages project when production is
ready. A preview keeps the production canonical URLs and the same
`robots.txt`. Cloudflare Pages sends an `X-Robots-Tag: noindex` header on
preview deployments. Other hosts should apply an equivalent header on
their preview origins. [Preview indexing](https://developers.cloudflare.com/pages/configuration/preview-deployments/)

Astro copies `public/_headers` to `dist/_headers`. Pages uses it to set
MIME sniffing, referrer, and browser permission policies on static
responses. The file sets long-lived caching for the fingerprinted assets
under `/_astro/`. HTML uses Cloudflare Pages' default caching.
[Cloudflare Pages custom headers](https://developers.cloudflare.com/pages/configuration/headers/)

The same `dist/` directory works on other static hosts. Serve it at the
origin root over HTTPS so the browser's Web Crypto API is available to
the token experiment. For local verification, run `npm run preview`;
the loopback origin counts as a secure context.
