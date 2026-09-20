#!/usr/bin/env node
/**
 * Lightweight regression scan: fail if known German UI chrome reappears
 * in application-owned string sources (shared labels, web UI, API messages).
 *
 * Intentionally skips: docs, node_modules, dist, seed company names,
 * money-parse German *input* examples, and test fixtures for German parsing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_ROOTS = [
  'apps/web/src',
  'apps/api/src',
  'apps/api/prisma/seed.ts',
  'packages/shared/src',
  'packages/financial-core/src',
];

const SKIP_FILE_RE =
  /(money-parse\.ts|money-parse\.test\.ts|scan-german-ui|node_modules|dist|\.map$)/i;

/** High-signal German UI phrases that must not appear in app chrome. */
const FORBIDDEN = [
  'Budget nach Kategorie',
  'Geplante Beträge',
  'Zahlungen für dieses Projekt',
  'Neue Zahlung',
  'Rechnung wählen',
  'Zahlungsdatum',
  'Zahlungsart',
  'Alle anzeigen',
  'Überweisung',
  'Ausgangsrechnung',
  'Eingangsrechnung',
  'Dieses Feld ist erforderlich',
  'Ungültiger Betrag',
  'Rechnung nicht gefunden',
  'Zahlung überschreitet',
  'Amount (€)',
  'Net Amount (€)',
  'Betrag (€)',
  'tt.mm.jjjj',
  'TT.MM.JJJJ',
];

/** Word-ish tokens common in German UI chrome (case-sensitive where accents matter). */
const FORBIDDEN_WORDS = [
  /\bSpeichern\b/,
  /\bAbbrechen\b/,
  /\bLöschen\b/,
  /\bBearbeiten\b/,
  /\bÜberfällig\b/,
  /\bStorniert\b/,
  /\bNettobetrag\b/,
  /\bBruttobetrag\b/,
  /\bAusgangsrechnung\b/,
  /\bEingangsrechnung\b/,
  /\bKorrespondenz\b/,
  /\bLastschrift\b/,
  /\bKreditkarte\b/,
  /\bMaterialien\b/,
  /\bEinstellungen\b/,
  /\bBenutzer\b/,
  /\bWillkommen\b/,
];

const EXT_RE = /\.(tsx?|jsx?|mjs|cjs|html)$/i;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full, out);
    } else if (EXT_RE.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function collectFiles() {
  const files = [];
  for (const rel of SCAN_ROOTS) {
    const abs = path.join(root, rel);
    if (fs.statSync(abs).isFile()) {
      files.push(abs);
    } else {
      walk(abs, files);
    }
  }
  return files.filter((f) => !SKIP_FILE_RE.test(f));
}

const hits = [];
for (const file of collectFiles()) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file).replace(/\\/g, '/');
  for (const phrase of FORBIDDEN) {
    if (text.includes(phrase)) {
      hits.push({ file: rel, match: phrase });
    }
  }
  for (const re of FORBIDDEN_WORDS) {
    const m = text.match(re);
    if (m) hits.push({ file: rel, match: m[0] });
  }
}

if (hits.length) {
  console.error('German UI chrome detected:\n');
  for (const h of hits) {
    console.error(`  ${h.file}: ${h.match}`);
  }
  process.exit(1);
}

console.log(`German UI scan OK (${collectFiles().length} files).`);
