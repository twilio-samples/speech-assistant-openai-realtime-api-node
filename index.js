import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import config from './src/config.js';
import logger from './src/logger.js';
import { registerRoutes } from './src/routes/index.js';

const fastify = Fastify({ logger });
await fastify.register(fastifyFormBody);
await fastify.register(fastifyWs);

registerRoutes(fastify);

// Graceful shutdown
const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutdown signal received');
    await fastify.close();
    process.exit(0);
};

for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => shutdown(signal));
}

fastify.listen({ port: config.server.port, host: config.server.host }, (err) => {
    if (err) {
        logger.error({ err }, 'Failed to start server');
        process.exit(1);
    }
    logger.info({
        port: config.server.port,
        supabase: config.supabase.configured ? 'configured' : 'NOT configured',
        businessId: config.business.id || 'NOT configured',
    }, 'Dental Voice Assistant started');
});
