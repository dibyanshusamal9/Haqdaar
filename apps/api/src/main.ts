import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { VoicebotGateway } from './call/voicebot';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.corsOrigins, methods: ['GET', 'POST', 'PATCH'], maxAge: 3600 });
  app.enableShutdownHooks();
  await app.listen(config.port);
  // The phone line: Exotel streams calls over a WebSocket on the same port.
  app.get(VoicebotGateway).attach(app.getHttpServer());
  Logger.log(`Haqdaar.ai API listening on http://localhost:${config.port}/api`, 'Bootstrap');
}

void bootstrap();
