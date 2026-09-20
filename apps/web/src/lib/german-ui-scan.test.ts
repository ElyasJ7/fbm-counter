import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../',
);

describe('German UI regression scan', () => {
  it('finds no known German UI chrome in app sources', () => {
    const script = path.join(repoRoot, 'scripts', 'scan-german-ui.mjs');
    const result = spawnSync(process.execPath, [script], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    assert.equal(
      result.status,
      0,
      result.stderr || result.stdout || 'scan failed',
    );
  });
});
