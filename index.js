import Fastify from 'fastify';
import WebSocket from 'ws';
import fs from 'fs';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';

// Load environment variables from .env file
dotenv.config();

// Retrieve the OpenAI API key from environment variables. You must have OpenAI Realtime API access.
const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
    console.error('Missing OpenAI API key. Please set it in the .env file.');
    process.exit(1);
}

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Constants
const SYSTEM_MESSAGE = `## Identidad
Tu nombre es Paula
Eres una agente de voz virtual de **Dapta**, una plataforma líder en inteligencia artificial que ayuda a las empresas a optimizar sus procesos de ventas y marketing con agentes de voz IA.
## Objetivo
Tu objetivo es calificar a clientes potenciales, entender sus necesidades y guiarlos hacia cómo Dapta puede mejorar la eficiencia de sus ventas mediante la automatización y agentes conversacionales, para concretar bookings con posibles prospectos.
## Directrices de respuesta
- **Pregunta una cosa a la vez**: Asegúrate de que el usuario pueda responder a cada pregunta antes de seguir.
- **Espera la respuesta del usuario**: No sigas con la conversación hasta que hayas recibido una respuesta.
- **Proporciona explicaciones claras**: Si es necesario, ofrece detalles sobre cómo **Dapta** puede ayudar, pero evita abrumar al cliente con demasiada información.
- **Si el cliente muestra interés**, ofrece agendar una llamada.
## Tarea
1. **Empieza la llamada mencionando el nombre del usuario** (usando la variable [contact_name]):
   - "[contact_name]?"
   - **Espera la respuesta del usuario y repite si no te escuchan.**
2. Si el usuario responde, preséntate y explica el motivo de la llamada:
   - "Hola, soy Paula la agente de IA de **Dapta**. Te contacto porque vi que mostrabas interés en cómo Dapta AI puede ayudar a [contact_company] a crear asistentes de voz con IA para calificar leads y agendar llamadas."
3. **Pregunta la industria**:
   - "Para entender mejor, ¿tu empresa es un e-commerce, agencia de marketing, o pertenece otra industria?"
4. **Clasifica al usuario según la industria**:
   - **Si es e-commerce**:
     - "Genial, ¿cuántos pedidos manejan al mes actualmente y cuál es la meta que desean alcanzar?"
     - "¿Cuántos de estos pedidos requieren confirmación manual?"
   - **Si es agencia de marketing**:
     - "¿Qué propósito tendría la implementación de IA para tu agencia?"
 - "Perfecto, ¿cuál es la facturación mensual de la agencia?"
   - **Si es otra industria**:
     - "¿Actualmente estás utilizando algún chatbot o automatización con IA?"
       - Si la respuesta es **sí**: "¡Excelente! ¿Cuáles son los principales retos que enfrentas con las herramientas que usas actualmente?"
       - Si la respuesta es **no**: "Entiendo, justamente podemos hacer que la adopción de IA sea lo más sencilla posible."
5. **Prospección adicional**:
   - "¿Tienes algún sistema en [company_url] que integre la automatización de ventas o atención al cliente?"
6. **Ofrece una solución personalizada**:
   - "Con Dapta, podemos generar llamadas con voz e IA para calificar clientes, prospectar usuarios y agendar reuniones, todo con una voz natural y disponible 24/7."
7. *Ofrece una llamada*: "¿Te gustaría reservar un espacio con uno de nuestros especialistas para ver cómo podríamos implementarlo en [contact_company]?"
   - **Espera la respuesta del usuario.**
8.1 **Manejo de objeciones o más información**:
   - Si el usuario está indeciso: "Puedo enviarte más información a [contact_email] y [contact_phone]. ¿Te gustaría recibirla?"
   - **Espera la respuesta del usuario.**
Pronunciacion de correo: No normalices los correos, por ejemplo “team@contsctship.ai” tenes que leerlo como “team arroba contactship punto ai
Pronunciacion de celular: Lee el celular numero por numero. Por ejemplo " 3-1-0-2-1-4-8-8-7-8"
9. **Cierra la conversación**:
   - Si el usuario acepta la llamada o información: "¡Perfecto! Te enviaré proximamente un enlace de agendamiento a [contact_email] y confirmaremos a este número de celular."
   - Si el usuario no muestra interés: "Gracias por tu tiempo, no dudes en contactarnos si en el futuro te interesa saber más sobre Dapta AI. ¡Que tengas un excelente día!"
   - Si no escuchas bien, repite la información.
## Constrains
**No cuelgues la llamada hasta obtener una respuesta de si el usuario desea agendar una llamada y despedirte**.
*Habla con acento de Bogotá, Colombia*
*Solo menciona una vez lo que hacemos en Dapta, no lo repitas*.
*No cuelgues la llamada durante los primeros 10 segundos.*
*No menciones más de una vez lo que hacemos en Dapta, ni suenes muy vendedora.*
*Haz la llamada de máx 1.5 minutos con el objetivo de llegar a la confirmación de la llamada lo más pronto posible.*
*No preguntes si desean que enviemos la informacion de una vez, ya que se enviara proximamente.
*El cliente usualmente te hablará en español, pero igual intenta detectar el idioma cuando te hable por primera vez*
## Variables que debes usar:
- [contact_name]: Nombre del contacto.
- [contact_email]: Correo electrónico del contacto.
- [contact_company]: Nombre de la empresa del contacto.
- [contact_rol]: Rol del contacto en la empresa.
- [contact_industry]: Industria en la que trabaja el contacto.
- [company_url]: URL de la página web de la empresa.
- [contact_phone]: Es el número de celular.
`
const VOICE = 'shimmer';
const PORT = process.env.PORT || 5050; // Allow dynamic port assignment

// List of Event Types to log to the console. See OpenAI Realtime API Documentation. (session.updated is handled separately.)
const LOG_EVENT_TYPES = [
    'response.content.done',
    'rate_limits.updated',
    'response.done',
    'input_audio_buffer.committed',
    'input_audio_buffer.speech_stopped',
    'input_audio_buffer.speech_started',
    'session.created'
];

// Root Route
fastify.get('/', async (request, reply) => {
    reply.send({ message: 'Twilio Media Stream Server is running!' });
});

// Route for Twilio to handle incoming and outgoing calls
// <Say> punctuation to improve text-to-speech translation
fastify.all('/incoming-call', async (request, reply) => {
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              <Say>Please wait while we connect your call to the A. I. voice assistant, powered by Twilio and the Open-A.I. Realtime API</Say>
                              <Pause length="1"/>
                              <Say>O.K. you can start talking!</Say>
                              <Connect>
                                  <Stream url="wss://${request.headers.host}/media-stream" />
                              </Connect>
                          </Response>`;

    reply.type('text/xml').send(twimlResponse);
});

// WebSocket route for media-stream
fastify.register(async (fastify) => {
    fastify.get('/media-stream', { websocket: true }, (connection, req) => {
        console.log('Client connected');


        const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "OpenAI-Beta": "realtime=v1"
            }
        });

        let streamSid = null;

        const sendSessionUpdate = () => {
            const sessionUpdate = {
                type: 'session.update',
                session: {
                    turn_detection: { type: 'server_vad' },
                    input_audio_format: 'g711_ulaw',
                    output_audio_format: 'g711_ulaw',
                    voice: VOICE,
                    instructions: SYSTEM_MESSAGE,
                    modalities: ["text", "audio"],
                    temperature: 0.8,
                }
            };

            console.log('Sending session update:', JSON.stringify(sessionUpdate));
            openAiWs.send(JSON.stringify(sessionUpdate));
        };

        // Open event for OpenAI WebSocket
        openAiWs.on('open', () => {
            console.log('Connected to the OpenAI Realtime API');
            setTimeout(sendSessionUpdate, 250); // Ensure connection stability, send after .25 seconds
        });

        // Listen for messages from the OpenAI WebSocket (and send to Twilio if necessary)
        openAiWs.on('message', (data) => {
            try {
                const response = JSON.parse(data);

                if (LOG_EVENT_TYPES.includes(response.type)) {
                    console.log(`Received event: ${response.type}`, response);
                }

                if (response.type === 'session.updated') {
                    console.log('Session updated successfully:', response);
                }

                if (response.type === 'response.audio.delta' && response.delta) {
                    const audioDelta = {
                        event: 'media',
                        streamSid: streamSid,
                        media: { payload: Buffer.from(response.delta, 'base64').toString('base64') }
                    };
                    connection.send(JSON.stringify(audioDelta));
                }
            } catch (error) {
                console.error('Error processing OpenAI message:', error, 'Raw message:', data);
            }
        });

        // Handle incoming messages from Twilio
        connection.on('message', (message) => {
            try {
                const data = JSON.parse(message);

                switch (data.event) {
                    case 'media':
                        if (openAiWs.readyState === WebSocket.OPEN) {
                            const audioAppend = {
                                type: 'input_audio_buffer.append',
                                audio: data.media.payload
                            };

                            openAiWs.send(JSON.stringify(audioAppend));
                        }
                        break;
                    case 'start':
                        streamSid = data.start.streamSid;
                        console.log('Incoming stream has started', streamSid);
                        break;
                    default:
                        console.log('Received non-media event:', data.event);
                        break;
                }
            } catch (error) {
                console.error('Error parsing message:', error, 'Message:', message);
            }
        });

        // Handle connection close
        connection.on('close', () => {
            if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
            console.log('Client disconnected.');
        });

        // Handle WebSocket close and errors
        openAiWs.on('close', () => {
            console.log('Disconnected from the OpenAI Realtime API');
        });

        openAiWs.on('error', (error) => {
            console.error('Error in the OpenAI WebSocket:', error);
        });
    });
});

fastify.listen({ port: PORT }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server is listening on port ${PORT}`);
});
