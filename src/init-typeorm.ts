import { Connection, createConnection } from 'typeorm';
import { withLogger } from 'kidsloop-nodejs-logger';
import { PDFMetadata } from './models/PDFMetadata';

const log = withLogger('init-typeorm');

let connection: Connection | undefined;

export const initialize = async (): Promise<Connection> => {
    try {
      connection = await createConnection({
        name: 'default',
        type: 'postgres',
        host: process.env.DB_HOST,
        username: process.env.DB_USER,
        port: +(process.env.DB_PORT || 5432),
        database: process.env.DB_DATABASE || 'postgres',
        password: process.env.DB_PASSWORD,
        entities: [PDFMetadata],

        logging: 'all',
        extra: {
          connectionLimit: 5
        }
      });
      await connection.synchronize();
      log.info(`TypeORM synchronized and ready`);
      if (!connection.hasMetadata(PDFMetadata)) {
        log.error('FATAL: TypeORM Metadata failed to load correctly. Check Babel, TypeORM configuration!');
        throw new Error('Failed to load TypeORM PDFMetadata entity metadata.');
      }
      return connection;
    } catch (error) {
      log.error(`Error setting up database connection: ${error.message}`);
      throw error;
    }
};