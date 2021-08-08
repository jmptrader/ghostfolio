import { join } from 'path';

import { AuthDeviceModule } from '@ghostfolio/api/app/auth-device/auth-device.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';

import { ConfigurationService } from '../services/configuration.service';
import { CronService } from '../services/cron.service';
import { DataGatheringService } from '../services/data-gathering.service';
import { ExchangeRateDataService } from '../services/exchange-rate-data.service';
import { PrismaService } from '../services/prisma.service';
import { AccessModule } from './access/access.module';
import { AccountModule } from './account/account.module';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './cache/cache.module';
import { CoreModule } from './core/core.module';
import { ExperimentalModule } from './experimental/experimental.module';
import { ExportModule } from './export/export.module';
import { ImportModule } from './import/import.module';
import { InfoModule } from './info/info.module';
import { OrderModule } from './order/order.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { RedisCacheModule } from './redis-cache/redis-cache.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { SymbolModule } from './symbol/symbol.module';
import { UserModule } from './user/user.module';
import { DataProviderModule } from '@ghostfolio/api/services/data-provider/data-provider.module';
import { PrismaModule } from '@ghostfolio/api/services/prisma.module';
import { ConfigurationModule } from '@ghostfolio/api/services/configuration.module';
import { DataGatheringModule } from '@ghostfolio/api/services/data-gathering.module';
import { ExchangeRateDataModule } from '@ghostfolio/api/services/exchange-rate-data.module';

@Module({
  imports: [
    AdminModule,
    AccessModule,
    AccountModule,
    AuthDeviceModule,
    AuthModule,
    CacheModule,
    ConfigModule.forRoot(),
    CoreModule,
    ExperimentalModule,
    ExportModule,
    ImportModule,
    InfoModule,
    OrderModule,
    PortfolioModule,
    RedisCacheModule,
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      serveStaticOptions: {
        /*etag: false // Disable etag header to fix PWA
        setHeaders: (res, path) => {
          if (path.includes('ngsw.json')) {
            // Disable cache (https://stackoverflow.com/questions/22632593/how-to-disable-webpage-caching-in-expressjs-nodejs/39775595)
            // https://gertjans.home.xs4all.nl/javascript/cache-control.html#no-cache
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        }*/
      },
      rootPath: join(__dirname, '..', 'client'),
      exclude: ['/api*']
    }),
    SubscriptionModule,
    SymbolModule,
    UserModule,
    DataProviderModule,
    DataGatheringModule,
    ExchangeRateDataModule,
    PrismaModule,
    ConfigurationModule
  ],
  controllers: [AppController],
  providers: [CronService]
})
export class AppModule {}
