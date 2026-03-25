import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TelegramModule } from './modules/telegram/telegram.module';
import { NlpModule } from './modules/nlp/nlp.module';
import { UserConfigModule } from './modules/user-config/user-config.module';
import { FixedCostsModule } from './modules/fixed-costs/fixed-costs.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { SummaryModule } from './modules/summary/summary.module';
import { AlertsModule } from './modules/alerts/alerts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: false,
      }),
    }),
    ScheduleModule.forRoot(),
    TelegramModule,
    NlpModule,
    UserConfigModule,
    FixedCostsModule,
    ExpensesModule,
    SummaryModule,
    AlertsModule,
  ],
})
export class AppModule {}
