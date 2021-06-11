import { Connection, createConnection } from 'typeorm';
import { PDFMetadata } from './models/PDFMetadata';
import { PDFPageMetadata } from './models/PDFPageMetadata';

let connection: Connection | undefined;

export default async (): Promise<Connection> => {
    try {
      connection = await createConnection({
        name: 'default',
        type: 'postgres',
        host: process.env.DB_HOST,
        username: process.env.DB_USER,
        port: +(process.env.DB_PORT || 5432),
        database: process.env.DB_DATABASE || 'h5p',
        password: process.env.DB_PASSWORD,
        entities: [
            PDFMetadata,
            PDFPageMetadata
        ],
        extra: {
          connectionLimit: 5
        }
      });
      await connection.synchronize();
      return connection;
    } catch (error) {
      console.error(`Error setting up database connection: ${error.message}`);
      throw error;
    }
};