#!/usr/bin/env node
/**
 * Check the production build in dist/ before it ships: no source maps, no server-only markers and no
 * credential-shaped strings in the files browsers download. The markers are canaries for server code
 * leaking into the bundle; the patterns catch a key itself, whatever it was called. Run after
 * `npm run build`. Exits non-zero with a list of problems (never the matched text). Pure checks, no network.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// sourceMappingURL points a browser at a source map; the rest exist only on the server (a secret's name, the verifier prefix in server/auth.js).
const FORBIDDEN_TEXT = ['sourceMappingURL', 'AUTH_PEPPER', 'verifier:v1:'];

// Key-shaped strings that must never reach a browser. Reported by label only, so a hit is not echoed into logs.
const CREDENTIAL_PATTERNS = [
  ['a Google-style API key', /AIza[0-9A-Za-z_-]{35}/],
  ['a private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

/** Scan a build directory. Returns the number of files checked and the problems found. */
export function checkDist(dist) {
  if (!fs.existsSync(path.join(dist, 'index.html'))) return { files: 0, problems: [`${dist} has no index.html: run npm run build first`] };
  const problems = [];
  let files = 0;
  for (const file of walk(dist)) {
    files++;
    const name = path.relative(dist, file).split(path.sep).join('/');
    if (name.endsWith('.map')) problems.push(`${name}: is a source map`);
    const text = fs.readFileSync(file, 'latin1'); // byte-for-byte, so fonts and images are scanned too
    for (const marker of FORBIDDEN_TEXT) if (text.includes(marker)) problems.push(`${name}: contains "${marker}"`);
    for (const [label, pattern] of CREDENTIAL_PATTERNS) if (pattern.test(text)) problems.push(`${name}: contains ${label}`);
  }
  return { files, problems };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { files, problems } = checkDist(path.join(ROOT, 'dist'));
  if (problems.length) {
    console.error(`check-dist: ${problems.length} problem(s)\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
  console.log(`check-dist: ${files} files, no source maps, server-only markers or credential-shaped strings`);
}
