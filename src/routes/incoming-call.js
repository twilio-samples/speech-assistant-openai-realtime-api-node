import logger from '../logger.js';

function sanitizePhone(phone) {
    return (phone || '').replace(/[^+\d]/g, '');
}

export function registerIncomingCallRoute(fastify) {
    fastify.all('/incoming-call', async (request, reply) => {
        const callerPhone = sanitizePhone(request.body?.From || request.query?.From || '');
        logger.info({ callerPhone }, 'Incoming call');

        const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="wss://${request.headers.host}/media-stream">
            <Parameter name="callerPhone" value="${callerPhone}" />
        </Stream>
    </Connect>
</Response>`;

        reply.type('text/xml').send(twimlResponse);
    });
}
