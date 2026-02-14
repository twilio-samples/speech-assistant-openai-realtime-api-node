import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePhone, validateDate } from '../src/services/supabase-client.js';

describe('validatePhone', () => {
    it('should accept valid international phone numbers', () => {
        assert.ok(validatePhone('+12025551234'));
        assert.ok(validatePhone('+447911123456'));
        assert.ok(validatePhone('12025551234'));
    });

    it('should accept phone numbers with formatting', () => {
        assert.ok(validatePhone('+1 (202) 555-1234'));
        assert.ok(validatePhone('+1-202-555-1234'));
    });

    it('should reject invalid phone numbers', () => {
        assert.equal(validatePhone(''), false);
        assert.equal(validatePhone('abc'), false);
        assert.equal(validatePhone('123'), false);
        assert.equal(validatePhone(null), false);
        assert.equal(validatePhone(undefined), false);
    });

    it('should reject numbers starting with 0', () => {
        assert.equal(validatePhone('0123456789'), false);
    });
});

describe('validateDate', () => {
    it('should accept valid YYYY-MM-DD dates', () => {
        assert.ok(validateDate('2025-01-15'));
        assert.ok(validateDate('2025-12-31'));
    });

    it('should reject invalid date formats', () => {
        assert.equal(validateDate('01-15-2025'), false);
        assert.equal(validateDate('2025/01/15'), false);
        assert.equal(validateDate('January 15'), false);
        assert.equal(validateDate(''), false);
        assert.equal(validateDate(null), false);
        assert.equal(validateDate(undefined), false);
    });
});
