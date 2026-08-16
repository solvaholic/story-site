#!/usr/bin/env node
// Builds every story under stories/<slug>/story.squiffy into dist/stories/<slug>/,
// applies a strict, hash-based Content-Security-Policy to each generated page
// (GitHub Pages serves no custom HTTP headers, so CSP has to travel as a <meta>
// tag), and assembles the static site shell from site/ into dist/.
//
// Uses the squiffy-packager binary installed by `npm ci` directly - never a
// network-resolving `npx squiffy-packager`, so a build never silently pulls a
// different (unreviewed) version.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storiesDir = path.join(repoRoot, 'stories');
const siteDir = path.join(repoRoot, 'site');
const distDir = path.join(repoRoot, 'dist');
const packagerBin = path.join(repoRoot, 'node_modules', '.bin', 'squiffy-packager');

// Files squiffy-packager writes next to the .squiffy source in its default
// (non --scriptonly) mode.
const GENERATED_STORY_FILES = ['index.html', 'story.js', 'squiffy.runtime.global.js', 'style.css'];

const INLINE_SCRIPT_RE = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;

function sha256Base64(text) {
  return createHash('sha256').update(text, 'utf8').digest('base64');
}

/**
 * Build a strict CSP string. `scriptHashes` is empty for pages with no inline
 * script. `runtime: true` opens the two directives squiffy-runtime's bundled
 * dependencies need on every page they run on, regardless of story content:
 * - 'unsafe-eval' on script-src - it bundles Handlebars, which compiles
 *   templates (dynamic text, conditionals) with `new Function()`.
 * - 'unsafe-inline' on style-src - an accessibility helper assigns
 *   `element.style.cssText` to build a visually-hidden screen-reader span.
 * Pages that never load the runtime (the static site index) don't need either.
 */
function buildCsp(scriptHashes, { runtime = false } = {}) {
  let scriptSrc = "'none'";
  if (scriptHashes.length) {
    const parts = ["'self'"];
    if (runtime) parts.push("'unsafe-eval'");
    parts.push(...scriptHashes.map((h) => `'sha256-${h}'`));
    scriptSrc = parts.join(' ');
  }
  const styleSrc = runtime ? "'self' 'unsafe-inline'" : "'self'";
  return [
    "default-src 'none'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "img-src 'self'",
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

/** Read an HTML file, hash its inline <script> blocks, and inject a CSP <meta> tag into <head>. */
function applyCsp(htmlPath, { runtime = false } = {}) {
  let html = readFileSync(htmlPath, 'utf8');

  const hashes = [];
  for (const match of html.matchAll(INLINE_SCRIPT_RE)) {
    hashes.push(sha256Base64(match[1]));
  }

  const csp = buildCsp(hashes, { runtime });
  const metaTag = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;

  if (!html.includes('<head>')) {
    throw new Error(`${htmlPath}: expected a <head> tag to inject CSP into`);
  }
  html = html.replace('<head>', `<head>\n    ${metaTag}`);

  writeFileSync(htmlPath, html);
}

function buildStory(slug) {
  const storyDir = path.join(storiesDir, slug);
  const sourceFile = path.join(storyDir, 'story.squiffy');
  if (!existsSync(sourceFile)) {
    throw new Error(`Expected ${sourceFile} to exist`);
  }

  console.log(`\nBuilding story: ${slug}`);
  // squiffy-packager always writes output next to the source file, so compile
  // in place, then move the generated files into dist/ and clean up the
  // source directory.
  execFileSync(packagerBin, [sourceFile], { stdio: 'inherit', cwd: storyDir });

  const outDir = path.join(distDir, 'stories', slug);
  mkdirSync(outDir, { recursive: true });

  for (const name of GENERATED_STORY_FILES) {
    const from = path.join(storyDir, name);
    const to = path.join(outDir, name);
    if (!existsSync(from)) {
      throw new Error(`squiffy-packager did not produce expected file: ${from}`);
    }
    cpSync(from, to);
    rmSync(from);
  }

  applyCsp(path.join(outDir, 'index.html'), { runtime: true });
}

function buildSite() {
  cpSync(siteDir, distDir, { recursive: true });

  // Copy licenses so the deployed site's footer links resolve without
  // depending on the repo also being visible at the same origin.
  for (const name of ['LICENSE', 'LICENSE-CC-BY-4.0']) {
    cpSync(path.join(repoRoot, name), path.join(distDir, name));
  }

  applyCsp(path.join(distDir, 'index.html'));
}

function main() {
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });

  buildSite();

  const slugs = readdirSync(storiesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const slug of slugs) {
    buildStory(slug);
  }

  console.log(`\nBuilt ${slugs.length} stor${slugs.length === 1 ? 'y' : 'ies'} to ${path.relative(repoRoot, distDir)}/`);
}

main();
