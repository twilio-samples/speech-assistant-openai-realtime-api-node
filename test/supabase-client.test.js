import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('executeToolCall', () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        // Set env vars needed by config
        process.env.OPENAI_API_KEY = 'test-key';
        process.env.SUPABASE_URL = 'https://test.supabase.co';
        process.env.SUPABASE_ANON_KEY = 'test-anon-key';
        process.env.BUSINESS_ID = 'test-business';
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should return error for unknown tool', async () => {
        const { executeToolCall } = await import(`../src/services/supabase-client.js?t=${Date.now()}`);
        const result = await executeToolCall('unknown_tool', {}, '+12025551234');
        assert.deepEqual(result, { error: 'Unknown tool' });
    });

    it('should return error when supabase is not configured', async () => {
        // Save and clear env vars before importing the module
        const savedUrl = process.env.SUPABASE_URL;
        const savedKey = process.env.SUPABASE_ANON_KEY;
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_ANON_KEY;

        try {
            // Fresh import picks up the missing env vars
            const { executeToolCall } = await import(`../src/services/supabase-client.js?unconfigured=${Date.now()}`);
            const result = await executeToolCall('lookup_patient', { phone: '+12025551234' }, '+12025551234');
            assert.ok(result.error);
            assert.ok(result.error.toLowerCase().includes('not configured') || result.error.toLowerCase().includes('failed'));
        } finally {
            // Restore env vars
            process.env.SUPABASE_URL = savedUrl;
            process.env.SUPABASE_ANON_KEY = savedKey;
        }
    });

    it('should return validation error for invalid phone', async () => {
        const { executeToolCall } = await import(`../src/services/supabase-client.js?t=${Date.now()}`);
        const result = await executeToolCall('lookup_patient', { phone: 'invalid' }, 'invalid');
        assert.ok(result.error);
        assert.ok(result.error.includes('phone'));
    });

    it('should return validation error for invalid dates', async () => {
        const { executeToolCall } = await import(`../src/services/supabase-client.js?t=${Date.now()}`);
        const result = await executeToolCall('check_availability', {
            start_date: 'not-a-date',
            end_date: '2025-01-15'
        }, '+12025551234');
        assert.ok(result.error);
        assert.ok(result.error.includes('date'));
    });

    it('should return validation error when start_date is after end_date', async () => {
        const { executeToolCall } = await import(`../src/services/supabase-client.js?t=${Date.now()}`);
        const result = await executeToolCall('check_availability', {
            start_date: '2025-01-20',
            end_date: '2025-01-15'
        }, '+12025551234');
        assert.ok(result.error);
        assert.ok(result.error.includes('before'));
    });

    it('should call supabase edge function for valid lookup_patient', async () => {
        let capturedUrl, capturedOptions;
        globalThis.fetch = async (url, options) => {
            capturedUrl = url;
            capturedOptions = options;
            return {
                json: async () => ({ found: true, profile: { first_name: 'Jane', last_name: 'Doe' } }),
                status: 200
            };
        };

        const { executeToolCall } = await import(`../src/services/supabase-client.js?t=${Date.now()}`);
        const result = await executeToolCall('lookup_patient', { phone: '+12025551234' }, '+12025551234');

        assert.ok(capturedUrl.includes('/functions/v1/voice-call-ai'));
        assert.equal(capturedOptions.method, 'POST');
        const body = JSON.parse(capturedOptions.body);
        assert.equal(body.action, 'lookup_patient');
        assert.equal(body.phone, '+12025551234');
        assert.ok(result.found);
    });

    it('should handle fetch errors gracefully', async () => {
        globalThis.fetch = async () => {
            throw new Error('Network error');
        };

        const { executeToolCall } = await import(`../src/services/supabase-client.js?t=${Date.now()}`);
        const result = await executeToolCall('lookup_patient', { phone: '+12025551234' }, '+12025551234');
        assert.ok(result.error);
        assert.ok(result.error.includes('Failed'));
    });
});
