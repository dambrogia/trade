import path from 'node:path';
import winston from 'winston';

export const dir = path.join(__dirname, '..', 'logs');

const format = winston.format.combine(
    winston.format.json(),
    winston.format.timestamp(),
);

export const logger = winston.createLogger({
    level: 'info',
    format: format,
    defaultMeta: {},
    transports: [
        //
        // - Write all logs with importance level of `error` or higher to `error.log`
        //   (i.e., error, fatal, but not other levels)
        //
        new winston.transports.File({
            filename: path.join(dir, 'error.log'),
            level: 'error',
            format,
        }),
        //
        // - Write all logs with importance level of `info` or higher to `combined.log`
        //   (i.e., fatal, error, warn, and info, but not trace)
        //
        new winston.transports.File({
            filename: path.join(dir, 'combined.log'),
            format,
        }),
    ],
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
    logger.add(
        new winston.transports.Console({
            format: winston.format.simple(),
        }),
    );
}
