import winston, { Logger } from 'winston';

type NPMLoggingLevels = 'silly' | 'debug' | 'verbose' | 'http' | 'info' | 'warn' | 'error';


const stdoutFormat = winston.format.printf(({ level, message, label, timestamp }) => {
    return `${timestamp} [${label}] ${level}: ${message}`
})

const defaultLoggingLevel = process.env.LOG_LEVEL ?? process.env.LEVEL ?? 'debug';

export const withLogger = (label: string, level?: NPMLoggingLevels): Logger => {
    return winston.loggers.add(label, {
        level: level ?? defaultLoggingLevel,
        format: winston.format.combine(
            winston.format.label({ label }),
            winston.format.timestamp(),
            winston.format.colorize(),
            stdoutFormat
        ),
        transports: [
            new winston.transports.Console()
        ]
    })
}

