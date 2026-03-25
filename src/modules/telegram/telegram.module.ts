import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { MessageDispatcherService } from './message-dispatcher.service';
import { OnboardingService } from './onboarding.service';
import { UserConfigModule } from '../user-config/user-config.module';
import { FixedCostsModule } from '../fixed-costs/fixed-costs.module';
import { SummaryModule } from '../summary/summary.module';
import { NlpModule } from '../nlp/nlp.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { RateLimiterService } from '../../common/services/rate-limiter.service';

@Module({
  imports: [ConfigModule, UserConfigModule, FixedCostsModule, SummaryModule, NlpModule, ExpensesModule],
  controllers: [TelegramController],
  providers: [TelegramService, MessageDispatcherService, OnboardingService, RateLimiterService],
  exports: [TelegramService, MessageDispatcherService, OnboardingService],
})
export class TelegramModule {}
