import dotenv from 'dotenv';
dotenv.config();

const required = (name) => {
    const val = process.env[name];
    if (!val) {
        console.error(`Missing required environment variable: ${name}`);
        process.exit(1);
    }
    return val;
};

const config = Object.freeze({
    openai: Object.freeze({
        apiKey: required('OPENAI_API_KEY'),
        model: process.env.OPENAI_MODEL || 'gpt-4o-realtime-preview-2024-12-17',
        realtimeUrl: process.env.OPENAI_REALTIME_URL || 'wss://api.openai.com/v1/realtime',
    }),
    supabase: Object.freeze({
        url: process.env.SUPABASE_URL || '',
        anonKey: process.env.SUPABASE_ANON_KEY || '',
        get configured() { return !!(this.url && this.anonKey); },
        timeoutMs: parseInt(process.env.SUPABASE_TIMEOUT_MS || '10000', 10),
    }),
    business: Object.freeze({
        id: process.env.BUSINESS_ID || '',
    }),
    server: Object.freeze({
        port: parseInt(process.env.PORT || '5050', 10),
        host: process.env.HOST || '0.0.0.0',
    }),
    voice: Object.freeze({
        name: process.env.VOICE || 'alloy',
        temperature: parseFloat(process.env.TEMPERATURE || '0.6'),
    }),
    vad: Object.freeze({
        type: 'server_vad',
        threshold: parseFloat(process.env.VAD_THRESHOLD || '0.5'),
        prefixPaddingMs: parseInt(process.env.VAD_PREFIX_PADDING_MS || '300', 10),
        silenceDurationMs: parseInt(process.env.VAD_SILENCE_DURATION_MS || '500', 10),
    }),
});

export default config;
