export * from './types';

import dotenv from 'dotenv';

dotenv.config();

export const config = {
    env: process.env.NODE_ENV || 'dev',
    port: Number(process.env.PORT) || 3000,
    logsPath: process.env.LOGS_PATH || './logs',
    transformsDir: process.env.TRANSFORMS_DIR || './transforms',
    templateDir: process.env.TEMPLATE_DIR || './templates',
    apiBaseUri: process.env.API_BASE_URI || '/api',

    sendgridApiKey: process.env.SENDGRID_API_KEY,
};
