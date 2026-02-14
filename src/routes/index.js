import { registerHealthRoute } from './health.js';
import { registerIncomingCallRoute } from './incoming-call.js';
import { registerMediaStreamRoute } from './media-stream.js';

export function registerRoutes(fastify) {
    registerHealthRoute(fastify);
    registerIncomingCallRoute(fastify);
    registerMediaStreamRoute(fastify);
}
