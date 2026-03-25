import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { UserConfigModule } from '../user-config/user-config.module';
import { SummaryModule } from '../summary/summary.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [UserConfigModule, SummaryModule, ExpensesModule, TelegramModule],
  providers: [AlertsService],
})
export class AlertsModule {}
