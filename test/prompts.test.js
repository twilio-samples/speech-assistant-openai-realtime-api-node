import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt } from '../src/prompts.js';

describe('buildSystemPrompt', () => {
    it('should contain the current date', () => {
        const prompt = buildSystemPrompt();
        const today = new Date().toISOString().split('T')[0];
        assert.ok(prompt.includes(today), `Prompt should contain today's date: ${today}`);
    });

    it('should contain the persona name Eric', () => {
        const prompt = buildSystemPrompt();
        assert.ok(prompt.includes('Eric'), 'Prompt should contain persona name Eric');
    });

    it('should contain the clinic name', () => {
        const prompt = buildSystemPrompt();
        assert.ok(prompt.includes('Caberu'), 'Prompt should contain clinic name');
    });

    it('should include workflow instructions', () => {
        const prompt = buildSystemPrompt();
        assert.ok(prompt.includes('Start of Call'), 'Prompt should include Start of Call step');
        assert.ok(prompt.includes('Book Appointment'), 'Prompt should include Book Appointment');
        assert.ok(prompt.includes('Cancel Appointment'), 'Prompt should include Cancel Appointment');
    });

    it('should include guidelines', () => {
        const prompt = buildSystemPrompt();
        assert.ok(prompt.includes('Be concise'), 'Prompt should include conciseness guideline');
        assert.ok(prompt.includes('emergency'), 'Prompt should include emergency guidance');
    });
});
