import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MoneyParseError, parseMoneyDe, parseMoneyDeToFixed } from './index';

describe('parseMoneyDe', () => {
  it('parses German 1.234,56', () => {
    assert.equal(parseMoneyDeToFixed('1.234,56'), '1234.5600');
  });

  it('parses 1234,56', () => {
    assert.equal(parseMoneyDeToFixed('1234,56'), '1234.5600');
  });

  it('parses thousand-only 1.234 as 1234', () => {
    assert.equal(parseMoneyDeToFixed('1.234'), '1234.0000');
  });

  it('parses 0,99', () => {
    assert.equal(parseMoneyDeToFixed('0,99'), '0.9900');
  });

  it('parses plain 1234.56', () => {
    assert.equal(parseMoneyDeToFixed('1234.56'), '1234.5600');
  });

  it('parses negative German amounts', () => {
    assert.equal(parseMoneyDe('-1.234,56').toFixed(2), '-1234.56');
  });

  it('rejects empty input', () => {
    assert.throws(() => parseMoneyDe(''), MoneyParseError);
  });

  it('rejects ambiguous US-style 1,234.56', () => {
    assert.throws(() => parseMoneyDe('1,234.56'), /Ambiguous|Invalid/);
  });

  it('rejects malformed values', () => {
    assert.throws(() => parseMoneyDe('12,,34'), MoneyParseError);
    assert.throws(() => parseMoneyDe('abc'), MoneyParseError);
  });
});
