import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import { registerIncomingCallRoute } from '../src/routes/incoming-call.js';

describe('/incoming-call route', () => {
    let fastify;

    beforeEach(async () => {
        fastify = Fastify();
        await fastify.register(fastifyFormBody);
        registerIncomingCallRoute(fastify);
        await fastify.ready();
    });

    it('should return TwiML response', async () => {
        const response = await fastify.inject({
            method: 'POST',
            url: '/incoming-call',
            headers: { 'content-type': 'application/x-www-form-urlencoded', host: 'example.com' },
            payload: 'From=%2B12025551234'
        });

        assert.equal(response.statusCode, 200);
        assert.ok(response.headers['content-type'].includes('text/xml'));
        assert.ok(response.body.includes('<Response>'));
        assert.ok(response.body.includes('<Stream'));
        assert.ok(response.body.includes('media-stream'));
    });

    it('should sanitize phone number in TwiML', async () => {
        const response = await fastify.inject({
            method: 'POST',
            url: '/incoming-call',
            headers: { 'content-type': 'application/x-www-form-urlencoded', host: 'example.com' },
            payload: 'From=%22%3E%3CScript%3Ealert(1)%3C/Script%3E'
        });

        assert.equal(response.statusCode, 200);
        // Should not contain any XML-breaking characters
        assert.ok(!response.body.includes('<Script>'), 'Should not contain injected script tags');
        assert.ok(!response.body.includes('alert(1)'), 'Should not contain injected script content');
    });

    it('should handle missing From parameter', async () => {
        const response = await fastify.inject({
            method: 'POST',
            url: '/incoming-call',
            headers: { 'content-type': 'application/x-www-form-urlencoded', host: 'example.com' },
            payload: ''
        });

        assert.equal(response.statusCode, 200);
        assert.ok(response.body.includes('<Response>'));
    });

    it('should accept GET requests with query params', async () => {
        const response = await fastify.inject({
            method: 'GET',
            url: '/incoming-call?From=%2B12025551234',
            headers: { host: 'example.com' }
        });

        assert.equal(response.statusCode, 200);
        assert.ok(response.body.includes('<Response>'));
    });
});
