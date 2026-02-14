import WebSocket from 'ws';
import config from '../config.js';
import logger from '../logger.js';
import { TOOLS } from '../tools.js';
import { buildSystemPrompt } from '../prompts.js';
import { executeToolCall } from '../services/supabase-client.js';

const LOG_EVENT_TYPES = [
    'error',
    'response.content.done',
    'response.done',
    'response.function_call_arguments.done',
    'session.created',
    'session.updated'
];

const MAX_RECONNECTS = 2;

export function registerMediaStreamRoute(fastify) {
    fastify.register(async (fastify) => {
        fastify.get('/media-stream', { websocket: true }, (connection, _req) => {
            const log = logger.child({ route: 'media-stream' });
            log.info('Client connected');

            // Connection-specific state
            let streamSid = null;
            let callerPhone = '';
            let latestMediaTimestamp = 0;
            let lastAssistantItem = null;
            let markQueue = [];
            let responseStartTimestampTwilio = null;
            let openAiWs = null;
            let reconnectAttempts = 0;
            let greetingSent = false;

            function connectToOpenAI() {
                const wsUrl = `${config.openai.realtimeUrl}?model=${config.openai.model}`;
                log.info({ url: wsUrl, attempt: reconnectAttempts }, 'Connecting to OpenAI Realtime API');

                openAiWs = new WebSocket(wsUrl, {
                    headers: {
                        Authorization: `Bearer ${config.openai.apiKey}`,
                        'OpenAI-Beta': 'realtime=v1'
                    }
                });

                openAiWs.on('open', () => {
                    log.info('Connected to OpenAI Realtime API');
                    setTimeout(initializeSession, 100);
                });

                openAiWs.on('message', async (data) => {
                    let response;
                    try {
                        response = JSON.parse(data);
                    } catch (parseErr) {
                        log.error({ err: parseErr }, 'Failed to parse OpenAI message');
                        return;
                    }

                    try {
                        if (LOG_EVENT_TYPES.includes(response.type)) {
                            log.info({ eventType: response.type }, 'OpenAI event');
                        }

                        // Handle audio output
                        if (response.type === 'response.audio.delta' && response.delta) {
                            const audioDelta = {
                                event: 'media',
                                streamSid: streamSid,
                                media: { payload: response.delta }
                            };
                            connection.send(JSON.stringify(audioDelta));

                            if (!responseStartTimestampTwilio) {
                                responseStartTimestampTwilio = latestMediaTimestamp;
                            }

                            if (response.item_id) {
                                lastAssistantItem = response.item_id;
                            }

                            sendMark(connection, streamSid);
                        }

                        // Handle function calls
                        if (response.type === 'response.function_call_arguments.done') {
                            let args;
                            try {
                                args = JSON.parse(response.arguments);
                            } catch (parseErr) {
                                log.error({ err: parseErr, raw: response.arguments }, 'Failed to parse function call arguments');
                                // Send error result back to OpenAI
                                const errorResult = {
                                    type: 'conversation.item.create',
                                    item: {
                                        type: 'function_call_output',
                                        call_id: response.call_id,
                                        output: JSON.stringify({ error: 'Failed to parse function arguments.' })
                                    }
                                };
                                openAiWs.send(JSON.stringify(errorResult));
                                openAiWs.send(JSON.stringify({ type: 'response.create' }));
                                return;
                            }
                            await handleFunctionCall(response.name, response.call_id, args);
                        }

                        // Handle speech interruption
                        if (response.type === 'input_audio_buffer.speech_started') {
                            handleSpeechStartedEvent();
                        }

                        // Log errors
                        if (response.type === 'error') {
                            log.error({ error: response.error }, 'OpenAI error');
                        }

                    } catch (error) {
                        log.error({ err: error }, 'Error processing OpenAI message');
                    }
                });

                openAiWs.on('close', (code) => {
                    log.warn({ code, reconnectAttempts }, 'OpenAI WebSocket closed');
                    if (code !== 1000 && reconnectAttempts < MAX_RECONNECTS) {
                        reconnectAttempts++;
                        const delay = 500 * reconnectAttempts;
                        log.info({ delay, attempt: reconnectAttempts }, 'Reconnecting to OpenAI');
                        setTimeout(() => connectToOpenAI(), delay);
                    }
                });

                openAiWs.on('error', (error) => {
                    log.error({ err: error }, 'OpenAI WebSocket error');
                });
            }

            // Initialize session with tools
            const initializeSession = () => {
                const sessionUpdate = {
                    type: 'session.update',
                    session: {
                        modalities: ['text', 'audio'],
                        instructions: buildSystemPrompt(),
                        voice: config.voice.name,
                        input_audio_format: 'g711_ulaw',
                        output_audio_format: 'g711_ulaw',
                        input_audio_transcription: {
                            model: 'whisper-1'
                        },
                        turn_detection: {
                            type: config.vad.type,
                            threshold: config.vad.threshold,
                            prefix_padding_ms: config.vad.prefixPaddingMs,
                            silence_duration_ms: config.vad.silenceDurationMs
                        },
                        tools: TOOLS,
                        tool_choice: 'auto',
                        temperature: config.voice.temperature
                    }
                };

                log.info('Sending session update with tools');
                openAiWs.send(JSON.stringify(sessionUpdate));

                // Send initial greeting only on first connect
                if (!greetingSent) {
                    greetingSent = true;
                    setTimeout(() => {
                        sendInitialGreeting();
                    }, 250);
                }
            };

            // Send initial greeting, mentioning caller ID lookup
            const sendInitialGreeting = async () => {
                let greetingContext = '';
                if (callerPhone && config.supabase.configured) {
                    try {
                        const lookupResult = await executeToolCall('lookup_patient', { phone: callerPhone }, callerPhone);
                        if (lookupResult.found && lookupResult.profile) {
                            greetingContext = `The caller has been identified as ${lookupResult.profile.first_name} ${lookupResult.profile.last_name}. Greet them by name.`;
                        } else {
                            greetingContext = 'The caller is not in our system. Greet them warmly and offer to help.';
                        }
                    } catch (e) {
                        log.error({ err: e }, 'Initial lookup failed');
                        greetingContext = 'Could not look up caller. Greet them warmly.';
                    }
                } else {
                    greetingContext = 'Greet the caller warmly and offer to help with appointments.';
                }

                const greetingItem = {
                    type: 'conversation.item.create',
                    item: {
                        type: 'message',
                        role: 'user',
                        content: [{
                            type: 'input_text',
                            text: `[System: ${greetingContext}] Start the conversation with a warm greeting.`
                        }]
                    }
                };

                openAiWs.send(JSON.stringify(greetingItem));
                openAiWs.send(JSON.stringify({ type: 'response.create' }));
            };

            // Handle function calls from OpenAI
            const handleFunctionCall = async (functionName, callId, args) => {
                log.info({ functionName, args }, 'Function call');

                const result = await executeToolCall(functionName, args, callerPhone);

                const functionResult = {
                    type: 'conversation.item.create',
                    item: {
                        type: 'function_call_output',
                        call_id: callId,
                        output: JSON.stringify(result)
                    }
                };

                openAiWs.send(JSON.stringify(functionResult));
                openAiWs.send(JSON.stringify({ type: 'response.create' }));
            };

            // Handle interruption
            const handleSpeechStartedEvent = () => {
                if (markQueue.length > 0 && responseStartTimestampTwilio !== null) {
                    const elapsedTime = latestMediaTimestamp - responseStartTimestampTwilio;

                    if (lastAssistantItem) {
                        const truncateEvent = {
                            type: 'conversation.item.truncate',
                            item_id: lastAssistantItem,
                            content_index: 0,
                            audio_end_ms: elapsedTime
                        };
                        openAiWs.send(JSON.stringify(truncateEvent));
                    }

                    connection.send(JSON.stringify({
                        event: 'clear',
                        streamSid: streamSid
                    }));

                    markQueue = [];
                    lastAssistantItem = null;
                    responseStartTimestampTwilio = null;
                }
            };

            // Send mark for playback tracking
            const sendMark = (conn, sid) => {
                if (sid) {
                    const markEvent = {
                        event: 'mark',
                        streamSid: sid,
                        mark: { name: 'responsePart' }
                    };
                    conn.send(JSON.stringify(markEvent));
                    markQueue.push('responsePart');
                }
            };

            // Start OpenAI connection
            connectToOpenAI();

            // Handle Twilio messages
            connection.on('message', (message) => {
                try {
                    const data = JSON.parse(message);

                    switch (data.event) {
                        case 'media':
                            latestMediaTimestamp = data.media.timestamp;
                            if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
                                const audioAppend = {
                                    type: 'input_audio_buffer.append',
                                    audio: data.media.payload
                                };
                                openAiWs.send(JSON.stringify(audioAppend));
                            }
                            break;

                        case 'start':
                            streamSid = data.start.streamSid;
                            if (data.start.customParameters?.callerPhone) {
                                callerPhone = data.start.customParameters.callerPhone;
                            }
                            log.info({ streamSid, callerPhone }, 'Stream started');
                            responseStartTimestampTwilio = null;
                            latestMediaTimestamp = 0;
                            break;

                        case 'mark':
                            if (markQueue.length > 0) {
                                markQueue.shift();
                            }
                            break;

                        default:
                            log.debug({ event: data.event }, 'Non-media event');
                            break;
                    }
                } catch (error) {
                    log.error({ err: error }, 'Error parsing Twilio message');
                }
            });

            connection.on('close', () => {
                if (openAiWs && openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
                log.info('Client disconnected');
            });

            connection.on('error', (error) => {
                log.error({ err: error }, 'Twilio WebSocket error');
            });
        });
    });
}
