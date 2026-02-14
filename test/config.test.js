import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('config', () => {
    let originalEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should apply default values for optional vars', async () => {
        process.env.OPENAI_API_KEY = 'test-key';
        delete process.env.PORT;
        delete process.env.VOICE;
        delete process.env.TEMPERATURE;
        delete process.env.VAD_THRESHOLD;

        // Clear module cache by using a dynamic import with query string
        const { default: config } = await import(`../src/config.js?t=${Date.now()}`);

        assert.equal(config.server.port, 5050);
        assert.equal(config.voice.name, 'alloy');
        assert.equal(config.voice.temperature, 0.6);
        assert.equal(config.vad.threshold, 0.5);
        assert.equal(config.vad.prefixPaddingMs, 300);
        assert.equal(config.vad.silenceDurationMs, 500);
    });

    it('should use custom values from env vars', async () => {
        process.env.OPENAI_API_KEY = 'test-key';
        process.env.PORT = '3000';
        process.env.VOICE = 'echo';
        process.env.TEMPERATURE = '0.8';
        process.env.VAD_THRESHOLD = '0.7';

        const { default: config } = await import(`../src/config.js?t=${Date.now()}`);

        assert.equal(config.server.port, 3000);
        assert.equal(config.voice.name, 'echo');
        assert.equal(config.voice.temperature, 0.8);
        assert.equal(config.vad.threshold, 0.7);
    });

    it('should report supabase as not configured when vars are missing', async () => {
        process.env.OPENAI_API_KEY = 'test-key';
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_ANON_KEY;

        const { default: config } = await import(`../src/config.js?t=${Date.now()}`);

        assert.equal(config.supabase.configured, false);
    });

    it('should report supabase as configured when vars are present', async () => {
        process.env.OPENAI_API_KEY = 'test-key';
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_ANON_KEY = 'anon-key';

        const { default: config } = await import(`../src/config.js?t=${Date.now()}`);

        assert.equal(config.supabase.configured, true);
    });

    it('should have frozen config object', async () => {
        process.env.OPENAI_API_KEY = 'test-key';

        const { default: config } = await import(`../src/config.js?t=${Date.now()}`);

        assert.ok(Object.isFrozen(config));
    });
});
