export const TOOLS = [
    {
        type: 'function',
        name: 'lookup_patient',
        description: 'Look up a patient by their phone number. Use this when the call starts to identify the caller, or when asked about patient information.',
        parameters: {
            type: 'object',
            properties: {
                phone: {
                    type: 'string',
                    description: 'The phone number to look up (caller ID or provided number)'
                }
            },
            required: ['phone']
        }
    },
    {
        type: 'function',
        name: 'check_availability',
        description: 'Check available appointment slots. Use when patient asks about availability or wants to see open times.',
        parameters: {
            type: 'object',
            properties: {
                start_date: {
                    type: 'string',
                    description: 'Start date in YYYY-MM-DD format'
                },
                end_date: {
                    type: 'string',
                    description: 'End date in YYYY-MM-DD format'
                },
                time_preference: {
                    type: 'string',
                    enum: ['morning', 'afternoon', 'evening', 'any'],
                    description: 'Preferred time of day'
                }
            },
            required: ['start_date', 'end_date']
        }
    },
    {
        type: 'function',
        name: 'book_appointment',
        description: 'Book an appointment for a patient. Confirm all details with the patient before calling this.',
        parameters: {
            type: 'object',
            properties: {
                patient_name: {
                    type: 'string',
                    description: "Patient's full name"
                },
                patient_phone: {
                    type: 'string',
                    description: "Patient's phone number"
                },
                appointment_date: {
                    type: 'string',
                    description: 'Appointment date and time (can be natural language like "tomorrow 3pm" or "Friday morning")'
                },
                reason: {
                    type: 'string',
                    description: 'Reason for the appointment (e.g., cleaning, checkup, toothache)'
                }
            },
            required: ['patient_name', 'patient_phone', 'appointment_date', 'reason']
        }
    },
    {
        type: 'function',
        name: 'cancel_appointment',
        description: 'Cancel an existing appointment. Always confirm with patient before cancelling.',
        parameters: {
            type: 'object',
            properties: {
                appointment_id: {
                    type: 'string',
                    description: 'ID of the appointment to cancel'
                }
            },
            required: ['appointment_id']
        }
    },
    {
        type: 'function',
        name: 'get_patient_appointments',
        description: 'Get upcoming appointments for a patient. Use when patient asks about their scheduled appointments.',
        parameters: {
            type: 'object',
            properties: {
                phone: {
                    type: 'string',
                    description: "Patient's phone number"
                }
            },
            required: ['phone']
        }
    }
];
