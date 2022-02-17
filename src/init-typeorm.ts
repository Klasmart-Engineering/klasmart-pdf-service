import { Connection, createConnection } from 'typeorm';
import { withLogger } from 'kidsloop-nodejs-logger';
import ormConfig from '../ormconfig';

const log = withLogger('init-typeorm');

let connection: Connection | undefined;

export const initialize = async (): Promise<Connection> => {
    try {
      connection = await createConnection(ormConfig);
      if (await connection.showMigrations()) {
        log.info(`Unapplied migrations found.  Applying migrations.`);
        try {
          await connection.runMigrations();
        } catch (err) {
          log.error(`Unable to apply migrations. Caused by: ${err.stack}`);
          throw new Error(`Unable to apply TypeScript migrations.`);
        }
      }
      log.info(`TypeORM ready`);
      return connection;
    } catch (error) {
      log.error(`Error setting up database connection: ${error.message}`);
      throw error;
    }
};