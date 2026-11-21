import { Global, Inject, Injectable, Logger, Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { config } from '../config';
import { Database } from './database';

export const DB = Symbol('Database');
export const InjectDb = () => Inject(DB);

@Injectable()
class DatabaseLifecycle implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Database');

  constructor(@InjectDb() private readonly db: Database) {}

  async onApplicationBootstrap() {
    await this.db.migrate((m) => this.logger.log(m));
  }

  async onApplicationShutdown() {
    await this.db.close();
  }
}

@Global()
@Module({
  providers: [{ provide: DB, useFactory: () => new Database(config.databaseUrl) }, DatabaseLifecycle],
  exports: [DB],
})
export class DatabaseModule {}
