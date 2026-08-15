# story-site

A site for publishing interactive fiction, interactive instructions, and troubleshooting guides as static web experiences, built with [Squiffy](https://github.com/textadventures/squiffy).

Squiffy is treated as a locked, reviewed upstream build dependency rather than something forked or modified in place - see [Supply chain](#supply-chain) below.

## Structure

```
site/            static site shell (hand-written index page, shared stylesheet)
stories/<slug>/  one folder per story, each containing a story.squiffy source
scripts/         build and local-preview tooling (no runtime dependencies)
dist/            generated output (git-ignored; never committed)
```

Adding a story means adding a new `stories/<slug>/story.squiffy` and a link to it in `site/index.html` - the index is intentionally static, not generated, so navigation stays simple and durable even if a story's runtime has a problem.

## Building and previewing locally

```sh
npm ci
npm run build     # compiles every story into dist/
npm run serve     # serves dist/ at http://localhost:8080/
npm run preview   # build + serve in one step
```

`npm run build` invokes the `squiffy-packager` binary installed by `npm ci` directly (never a network-resolving `npx squiffy-packager`), so a build never silently pulls an unreviewed version of the compiler.

## Content Security Policy

GitHub Pages serves no custom HTTP response headers, so CSP has to travel as a `<meta http-equiv="Content-Security-Policy">` tag in each page. The build script:

- Computes a `sha256-` hash of Squiffy's generated inline bootstrap script and allows only that exact script by hash, instead of a broader `'unsafe-inline'`.
- Sets `default-src 'none'` and only opens `script-src`, `style-src`, and `img-src` to `'self'` (plus the story's script hash).
- Applies the same policy to the static site shell.

All stories currently share one origin and one CSP; this may change later if a story needs a materially different trust boundary (e.g., handling sensitive data).

## Supply chain

- `@textadventures/squiffy-cli` is pinned to an exact version in `package.json`, with `package-lock.json` committed and reviewed.
- Builds use `npm ci`, never a version-resolving install.
- `.squiffy` files are treated as executable source: embedded JavaScript and any external resources they reference get reviewed before merging.

## Licensing

- Code (build scripts, tooling, configuration) is licensed under [MIT](LICENSE).
- Story content (`.squiffy` sources and the prose/text they contain) is licensed under [CC BY 4.0](LICENSE-CC-BY-4.0), since MIT's license text is scoped to software and doesn't naturally cover prose.

## Status

This repository is being scaffolded incrementally. Remaining work includes GitHub Actions build/deploy jobs, Dependabot configuration for the pinned Squiffy dependency, and deployment verification.
