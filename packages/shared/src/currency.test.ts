import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertSupportedCurrency,
  assertSupportedTimezone,
  isSupportedCurrency,
  isSupportedTimezone,
  SUPPORTED_CURRENCIES,
  SUPPORTED_TIMEZONES,
} from './index.ts';

describe('supported currencies', () => {
  it('accepts AFN and USD only', () => {
    assert.deepEqual([...SUPPORTED_CURRENCIES], ['AFN', 'USD']);
    assert.equal(isSupportedCurrency('afn'), true);
    assert.equal(assertSupportedCurrency('usd'), 'USD');
  });

  it('rejects EUR and other unknown codes', () => {
    assert.equal(isSupportedCurrency('EUR'), false);
    assert.equal(isSupportedCurrency('GBP'), false);
    assert.throws(() => assertSupportedCurrency('EUR'), /Unsupported currency/);
    assert.throws(() => assertSupportedCurrency('GBP'), /Unsupported currency/);
  });
});

describe('supported timezones', () => {
  it('includes Asia/Kabul and UTC', () => {
    assert.ok(SUPPORTED_TIMEZONES.includes('Asia/Kabul'));
    assert.ok(SUPPORTED_TIMEZONES.includes('UTC'));
    assert.equal(assertSupportedTimezone('Asia/Kabul'), 'Asia/Kabul');
  });

  it('rejects unknown zones', () => {
    assert.equal(isSupportedTimezone('Mars/Phobos'), false);
    assert.throws(
      () => assertSupportedTimezone('Mars/Phobos'),
      /Unsupported timezone/,
    );
  });
});
