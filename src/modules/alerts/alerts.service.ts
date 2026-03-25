import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UserConfigService } from '../user-config/user-config.service';
import { SummaryService } from '../summary/summary.service';
import { ExpensesService } from '../expenses/expenses.service';
import { TelegramService } from '../telegram/telegram.service';
import { buildBurnRateAlert, buildMonthlyReport } from '../../common/constants/alert-messages';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly userConfigService: UserConfigService,
    private readonly summaryService: SummaryService,
    private readonly expensesService: ExpensesService,
    private readonly telegramService: TelegramService,
  ) {}

  @Cron('0 20 * * *', { name: 'daily-burn-rate-alert' })
  async sendDailyBurnRateAlert(): Promise<void> {
    this.logger.log('Running daily burn-rate alert cron...');
    const users = await this.userConfigService.findAllActive();
    const dayOfMonth = new Date().getDate();

    for (const user of users) {
      try {
        const summary = await this.summaryService.recalculate(user.id);
        const burnRate = Number(summary.burnRatePercent);

        // Only alert in first 10 days if burn > 40%
        if (dayOfMonth <= 10 && burnRate <= 40) continue;
        // After day 10, alert if burn > 70%
        if (dayOfMonth > 10 && burnRate <= 70) continue;

        const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const categories = await this.expensesService.getSpentByCategory(user.id, month);
        const topCategory = categories[0]?.category ?? 'Outros';

        const message = buildBurnRateAlert(
          burnRate,
          topCategory,
          Number(summary.remaining),
          dayOfMonth,
        );

        await this.telegramService.sendMarkdown(user.telegramChatId, message);
        this.logger.log(`Sent burn-rate alert to chatId: ${user.telegramChatId}`);
      } catch (err) {
        this.logger.error(`Failed to send alert to user ${user.id}:`, err);
      }
    }
  }

  @Cron('59 23 28-31 * *', { name: 'monthly-close-accounts' })
  async closeMonthlyAccounts(): Promise<void> {
    // Only run on the actual last day of the month
    const now = new Date();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (now.getDate() !== lastDayOfMonth) return;

    this.logger.log('Running monthly close cron...');
    const users = await this.userConfigService.findAllActive();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    for (const user of users) {
      try {
        const summary = await this.summaryService.recalculate(user.id);
        await this.summaryService.closeMonth(user.id);

        const categories = await this.expensesService.getSpentByCategory(user.id, month);
        const message = buildMonthlyReport(
          month,
          Number(summary.spendingCeilingSnapshot),
          Number(summary.fixedCostsTotal),
          Number(summary.variableSpent),
          Number(summary.remaining),
          categories,
        );

        await this.telegramService.sendMarkdown(user.telegramChatId, message);
        this.logger.log(`Sent monthly report to chatId: ${user.telegramChatId}`);
      } catch (err) {
        this.logger.error(`Failed to close month for user ${user.id}:`, err);
      }
    }
  }
}
