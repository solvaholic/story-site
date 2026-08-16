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
- Sets `default-src 'none'` and only opens `script-src`, `style-src`, and `img-src` to `'self'` (plus the story's script hash), except for two directives `squiffy-runtime` itself requires on any page that loads it, regardless of story content:
  - `script-src 'unsafe-eval'` - the runtime bundles Handlebars, which compiles templates (dynamic text, conditionals) with `new Function()`.
  - `style-src 'unsafe-inline'` - an accessibility helper assigns `element.style.cssText` to build a visually-hidden screen-reader span.
- Applies the stricter policy (no `unsafe-eval`, no `unsafe-inline`) to the static site shell, which never loads the runtime.

Both loosened directives were found by actually loading a compiled story in a browser and reading the console error, not by inspecting the generated HTML alone - a hash-only check on the bootstrap script isn't sufficient to catch CSP violations the runtime itself triggers once it starts running. Load `npm run preview` and click through a story after any CSP or Squiffy-version change.

All stories currently share one origin and one CSP; this may change later if a story needs a materially different trust boundary (e.g., handling sensitive data).

## Continuous integration and deployment

`.github/workflows/deploy.yml` runs on every push and pull request:

- **`build`** (unprivileged: `contents: read` only) runs `npm ci` and `npm run build`, then uploads `dist/` as a Pages artifact. Runs on pushes, pull requests, and manual dispatch, so a PR gets a build check without needing deployment credentials.
- **`deploy`** (`pages: write`, `id-token: write`) only runs on pushes to `main`. It deploys the artifact `build` already produced - it never checks out the repository or runs any story build script itself.

All actions are pinned to exact commit SHAs (not tags), and the two jobs' permissions are scoped separately so a build-time compromise has no path to deployment credentials.

## Supply chain

- `@textadventures/squiffy-cli` is pinned to an exact version in `package.json`, with `package-lock.json` committed and reviewed.
- Builds use `npm ci`, never a version-resolving install.
- `.squiffy` files are treated as executable source: embedded JavaScript and any external resources they reference get reviewed before merging.
- `.github/dependabot.yml` proposes npm and GitHub Actions updates as pull requests on a weekly schedule. Dependabot never auto-merges - a human always reviews and merges. Ordinary updates just need to pass CI; a `@textadventures/squiffy-cli` update additionally needs a deliberate manual review of its release notes, resolved dependency changes, provenance, generated output, and the CSP assumptions in `scripts/build.mjs`, since it's the one dependency that generates code this site ships to visitors.

## Licensing

- Code (build scripts, tooling, configuration) is licensed under [MIT](LICENSE).
- Story content (`.squiffy` sources and the prose/text they contain) is licensed under [CC BY 4.0](LICENSE-CC-BY-4.0), since MIT's license text is scoped to software and doesn't naturally cover prose.

## Status

This repository is being scaffolded incrementally. Remaining work includes Dependabot configuration for the pinned Squiffy dependency and deployment verification.
