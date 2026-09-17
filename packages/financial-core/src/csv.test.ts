import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { csvEscapeCell, neutralizeCsvFormula, toCsvDocument } from './index';

describe('CSV formula injection', () => {
  it('neutralizes =CMD()', () => {
    assert.equal(neutralizeCsvFormula('=CMD()'), "'=CMD()");
  });

  it('neutralizes +SUM(...)', () => {
    assert.equal(neutralizeCsvFormula('+SUM(A1:A2)'), "'+SUM(A1:A2)");
  });

  it('keeps plain negative numbers numeric', () => {
    assert.equal(neutralizeCsvFormula('-12.5'), '-12.5');
  });

  it('neutralizes formula-like -1+2', () => {
    assert.equal(neutralizeCsvFormula('-1+2'), "'-1+2");
  });

  it('neutralizes @something', () => {
    assert.equal(neutralizeCsvFormula('@something'), "'@something");
  });

  it('quotes neutralized cells in CSV', () => {
    const csv = toCsvDocument([['Name', '=CMD()']]);
    assert.match(csv, /"'=CMD\(\)"/);
  });

  it('escapes separators without corrupting numbers', () => {
    assert.equal(csvEscapeCell('12.50'), '12.50');
    assert.equal(csvEscapeCell('Acme; GmbH'), '"Acme; GmbH"');
  });
});
