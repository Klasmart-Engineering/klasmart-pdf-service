import { Connection, createConnection } from 'typeorm';
import { withLogger } from './logger';
import { PDFMetadata } from './models/PDFMetadata';
import { PDFPageMetadata } from './models/PDFPageMetadata';

const log = withLogger('init-typeorm');

let connection: Connection | undefined;

export default async (): Promise<Connection> => {
    try {
      connection = await createConnection({
        name: 'default',
        type: 'postgres',
        host: process.env.DB_HOST,
        username: process.env.DB_USER,
        port: +(process.env.DB_PORT || 5432),
        database: process.env.DB_DATABASE || 'postgres',
        password: process.env.DB_PASSWORD,
        entities: [
            PDFMetadata,
            PDFPageMetadata
        ],
        logging: process.env.TYPEORM_LOGGING?.toUpperCase() === 'TRUE' ? true : false,
        extra: {
          connectionLimit: 5
        }
      });
      await connection.synchronize();
      log.info(`TypeORM synchronized and ready`);
      return connection;
    } catch (error) {
      log.error(`Error setting up database connection: ${error.message}`);
      throw error;
    }
};