import { Connection, createConnection } from 'typeorm';
import { withLogger } from '@kl-engineering/kidsloop-nodejs-logger';
import { PDFMetadata } from './models/PDFMetadata';
import ormConfig from './ormconfig';

const log = withLogger('init-typeorm');

let connection: Connection | undefined;

export const initialize = async (): Promise<Connection> => {
    try {
      log.debug(`Creating database connection from ormConfig`);
      connection = await createConnection(ormConfig);
      log.debug(`Finding migrations`);
      if (await connection.showMigrations()) {
        log.info(`Unapplied migrations found.  Applying migrations.`);
        try {
          await connection.runMigrations();
        } catch (err) {
          log.error(`Unable to apply migrations. Caused by: ${err.stack}`);
          throw new Error(`Unable to apply TypeScript migrations.`);
        }
      }
      log.info(`TypeORM synchronized and ready`);
      if (!connection.hasMetadata(PDFMetadata)) {
        log.error('FATAL: TypeORM Metadata failed to load correctly. Check Babel, TypeORM configuration!');
        throw new Error('Failed to load TypeORM PDFMetadata entity metadata.');
      }
    
      log.info(`TypeORM ready`);
      return connection;
    } catch (error) {
      log.error(`Error setting up database connection: ${error.message}`);
      throw error;
    }
};
