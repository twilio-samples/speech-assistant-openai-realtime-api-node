import config from '../config.js';
import logger from '../logger.js';

const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validatePhone(phone) {
    if (!phone) return false;
    return PHONE_REGEX.test(phone.replace(/[\s\-()]/g, ''));
}

export function validateDate(date) {
    if (!date) return false;
    return DATE_REGEX.test(date);
}

function buildRequestBody(name, args, callerPhone) {
    switch (name) {
        case 'lookup_patient':
            return {
                action: 'lookup_patient',
                phone: args.phone || callerPhone,
                business_id: config.business.id
            };

        case 'check_availability':
            return {
                message: `Check availability from ${args.start_date} to ${args.end_date}`,
                conversation_history: [],
                caller_phone: callerPhone,
                business_id: config.business.id
            };

        case 'book_appointment':
            return {
                name: args.patient_name,
                phone: args.patient_phone || callerPhone,
                appointment_date: args.appointment_date,
                symptoms: args.reason,
                business_id: config.business.id
            };

        case 'cancel_appointment':
            return {
                message: `Cancel appointment ${args.appointment_id}`,
                conversation_history: [],
                caller_phone: callerPhone,
                business_id: config.business.id
            };

        case 'get_patient_appointments':
            return {
                message: 'What are my upcoming appointments?',
                conversation_history: [],
                caller_phone: args.phone || callerPhone,
                business_id: config.business.id
            };

        default:
            return null;
    }
}

function validateToolArgs(name, args, callerPhone) {
    switch (name) {
        case 'lookup_patient': {
            const phone = args.phone || callerPhone;
            if (phone && !validatePhone(phone)) {
                return 'Invalid phone number format.';
            }
            break;
        }
        case 'check_availability':
            if (!validateDate(args.start_date) || !validateDate(args.end_date)) {
                return 'Invalid date format. Please use YYYY-MM-DD.';
            }
            if (args.start_date > args.end_date) {
                return 'Start date must be before or equal to end date.';
            }
            break;
        case 'book_appointment': {
            const phone = args.patient_phone || callerPhone;
            if (phone && !validatePhone(phone)) {
                return 'Invalid phone number format.';
            }
            if (!args.patient_name || !args.appointment_date || !args.reason) {
                return 'Missing required booking details.';
            }
            break;
        }
        case 'cancel_appointment':
            if (!args.appointment_id) {
                return 'Missing appointment ID.';
            }
            break;
        case 'get_patient_appointments': {
            const phone = args.phone || callerPhone;
            if (phone && !validatePhone(phone)) {
                return 'Invalid phone number format.';
            }
            break;
        }
    }
    return null;
}

export async function executeToolCall(name, args, callerPhone) {
    const log = logger.child({ tool: name, callerPhone });
    log.info({ args }, 'Executing tool call');

    if (!config.supabase.configured) {
        log.error('Supabase not configured');
        return { error: 'Backend not configured. Please contact support.' };
    }

    const validationError = validateToolArgs(name, args, callerPhone);
    if (validationError) {
        log.warn({ validationError }, 'Tool argument validation failed');
        return { error: validationError };
    }

    const body = buildRequestBody(name, args, callerPhone);
    if (!body) {
        return { error: 'Unknown tool' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.supabase.timeoutMs);

    try {
        const edgeFunctionUrl = `${config.supabase.url}/functions/v1/voice-call-ai`;
        log.debug({ url: edgeFunctionUrl }, 'Calling Supabase Edge Function');

        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.supabase.anonKey}`,
                'apikey': config.supabase.anonKey,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        const result = await response.json();
        log.info({ status: response.status }, 'Tool call completed');
        return result;

    } catch (error) {
        if (error.name === 'AbortError') {
            log.error('Tool call timed out');
            return { error: 'Request timed out. Please try again.' };
        }
        log.error({ err: error }, 'Tool execution error');
        return { error: 'Failed to execute action. Please try again.' };
    } finally {
        clearTimeout(timeout);
    }
}
