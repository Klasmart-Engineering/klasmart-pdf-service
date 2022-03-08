import { ConnectionOptions } from 'typeorm';
import { PDFMetadata } from './models/PDFMetadata';

export default {
    name: 'default',
    type: 'postgres',
    host: process.env.DB_HOST,
    username: process.env.DB_USER,
    port: +(process.env.DB_PORT || 5432),
    database: process.env.DB_DATABASE || 'postgres',
    password: process.env.DB_PASSWORD,
    entities: [ PDFMetadata ],

    migrations: [ 'migration/*.{js,ts}' ],
    cli: {
        migrationsDir: 'migration'
    },

    logging: process.env.TYPEORM_LOGGING || 'all',
    extra: {
      connectionLimit: 5
    }
} as ConnectionOptions;