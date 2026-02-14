import config from '../config.js';

export function registerHealthRoute(fastify) {
    fastify.get('/', async (_request, reply) => {
        reply.send({
            message: 'Dental Voice Assistant Server is running!',
            supabase_configured: config.supabase.configured,
            business_id: config.business.id ? 'configured' : 'not configured'
        });
    });
}
