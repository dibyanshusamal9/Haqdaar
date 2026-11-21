import { Controller, Get, Module } from '@nestjs/common';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { CallController } from './call/call.controller';
import { CallService } from './call/call.service';
import { TranslateService } from './call/translate.service';
import { TtsService } from './call/tts.service';
import { VoicebotGateway } from './call/voicebot';
import { Database } from './db/database';
import { DatabaseModule, InjectDb } from './db/database.module';
import { MatchController } from './match/match.controller';
import { MatchService } from './match/match.service';
import { ExtractorService } from './profile/extractor.service';
import { ProfileController } from './profile/profile.controller';
import { SttService } from './profile/stt.service';
import { SchemesController } from './schemes/schemes.controller';
import { SchemesService } from './schemes/schemes.service';

@Controller('health')
class HealthController {
  constructor(@InjectDb() private readonly db: Database) {}

  @Get()
  async health() {
    const row = await this.db.one<{ schemes: number; v: number }>(
      'select (select count(*)::int from schemes where withdrawn_at is null) as schemes, haqdaar_corpus_version() as v',
    );
    return { status: 'ok', schemes: row?.schemes ?? 0, corpusVersion: row?.v ?? 0 };
  }
}

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, SchemesController, ProfileController, MatchController, CallController, AdminController],
  providers: [SchemesService, MatchService, SttService, ExtractorService, TtsService, TranslateService, CallService, VoicebotGateway, AdminService],
})
export class AppModule {}
