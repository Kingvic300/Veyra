import { Module, type DynamicModule, type OnApplicationShutdown, Inject } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type pg from 'pg';
import { APP_CONFIG, type AppConfig } from './config.js';
import { DB, PG_POOL, createDb, createPool } from './db/database.js';
import { ErrorFilter } from './common/errors.js';
import { EncryptionService } from './common/encryption.service.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthService } from './auth/auth.service.js';
import { AccessService } from './access/access.service.js';
import { AuditService } from './audit/audit.service.js';
import { AuditController } from './audit/audit.controller.js';
import { ChainService } from './chain/chain.service.js';
import { OrganisationsService } from './organisations/organisations.service.js';
import { OrganisationsController } from './organisations/organisations.controller.js';
import { ContractorsService } from './contractors/contractors.service.js';
import { ContractorsController } from './contractors/contractors.controller.js';
import { BatchesService } from './batches/batches.service.js';
import { BatchesController } from './batches/batches.controller.js';
import { BullTxMonitor, InlineTxMonitor, TxMonitor } from './jobs/tx-monitor.js';
import { ReconcilerService } from './jobs/reconciler.service.js';
import { HealthController } from './health.controller.js';

class PoolCloser implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}
  async onApplicationShutdown() {
    await this.pool.end();
  }
}

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        JwtModule.register({ secret: config.jwtSecret, signOptions: { algorithm: 'HS256' }, verifyOptions: { algorithms: ['HS256'] } }),
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
      ],
      controllers: [
        HealthController,
        AuthController,
        OrganisationsController,
        ContractorsController,
        BatchesController,
        AuditController,
      ],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: PG_POOL, useFactory: () => createPool(config.databaseUrl) },
        { provide: DB, useFactory: (pool: pg.Pool) => createDb(pool), inject: [PG_POOL] },
        { provide: TxMonitor, useClass: config.redisUrl ? BullTxMonitor : InlineTxMonitor },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_FILTER, useClass: ErrorFilter },
        PoolCloser,
        EncryptionService,
        AuthService,
        AccessService,
        AuditService,
        ChainService,
        OrganisationsService,
        ContractorsService,
        BatchesService,
        ReconcilerService,
      ],
    };
  }
}
