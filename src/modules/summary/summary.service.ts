import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MonthlySummary } from './entities/monthly-summary.entity';
import { ExpensesService } from '../expenses/expenses.service';
import { FixedCostsService } from '../fixed-costs/fixed-costs.service';
import { UserConfigService } from '../user-config/user-config.service';

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);

  constructor(
    @InjectRepository(MonthlySummary)
    private readonly repo: Repository<MonthlySummary>,
    private readonly expensesService: ExpensesService,
    private readonly fixedCostsService: FixedCostsService,
    private readonly userConfigService: UserConfigService,
  ) {}

  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private getDaysLeftInMonth(): number {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return lastDay - now.getDate();
  }

  async getOrCreateCurrentMonth(userConfigId: number): Promise<MonthlySummary> {
    const month = this.getCurrentMonth();
    const existing = await this.repo.findOne({ where: { userConfigId, month } });
    if (existing) return existing;

    const user = await this.userConfigService.findById(userConfigId);
    const fixedTotal = await this.fixedCostsService.getTotalFixed(userConfigId);

    const summary = this.repo.create({
      userConfigId,
      month,
      spendingCeilingSnapshot: Number(user.spendingCeiling),
      fixedCostsTotal: fixedTotal,
      variableSpent: 0,
      remaining: Number(user.spendingCeiling) - fixedTotal,
      burnRatePercent: 0,
    });
    return this.repo.save(summary);
  }

  async recalculate(userConfigId: number): Promise<MonthlySummary> {
    const summary = await this.getOrCreateCurrentMonth(userConfigId);
    const variableSpent = await this.expensesService.getTotalVariableSpentThisMonth(userConfigId);
    const fixedTotal = await this.fixedCostsService.getTotalFixed(userConfigId);

    const variableCeiling = Number(summary.spendingCeilingSnapshot) - fixedTotal;
    const remaining = variableCeiling - variableSpent;
    const burnRatePercent = variableCeiling > 0 ? (variableSpent / variableCeiling) * 100 : 0;

    summary.variableSpent = variableSpent;
    summary.fixedCostsTotal = fixedTotal;
    summary.remaining = remaining;
    summary.burnRatePercent = Math.round(burnRatePercent * 100) / 100;

    return this.repo.save(summary);
  }

  async closeMonth(userConfigId: number): Promise<void> {
    const month = this.getCurrentMonth();
    await this.repo.update(
      { userConfigId, month },
      { closedAt: new Date() },
    );
  }

  async getFormattedBalance(userConfigId: number): Promise<string> {
    const summary = await this.recalculate(userConfigId);
    const daysLeft = this.getDaysLeftInMonth();
    const fmt = (v: number) =>
      v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
      `💵 *Saldo restante: R$ ${fmt(Number(summary.remaining))}*\n\n` +
      `📊 ${Number(summary.burnRatePercent).toFixed(1)}% do teto variável gasto\n` +
      `📅 ${daysLeft} dias restantes no mês`
    );
  }

  async projectCanBuy(
    userConfigId: number,
    amount: number,
  ): Promise<{ canBuy: boolean; message: string }> {
    const summary = await this.recalculate(userConfigId);
    const daysLeft = this.getDaysLeftInMonth();
    const lookbackDays = Math.min(7, new Date().getDate());
    const dailyAverage = await this.expensesService.getDailyAverage(userConfigId, lookbackDays);

    const variableSpent = Number(summary.variableSpent);
    const variableCeiling =
      Number(summary.spendingCeilingSnapshot) - Number(summary.fixedCostsTotal);
    const projectedSpend = variableSpent + dailyAverage * daysLeft;
    const projectedRemaining = variableCeiling - projectedSpend - amount;

    const fmt = (v: number) =>
      v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (projectedRemaining >= 0) {
      return {
        canBuy: true,
        message:
          `✅ *Sim, você pode comprar!*\n\n` +
          `Após a compra de R$ ${fmt(amount)}, sua projeção para o fim do mês seria:\n` +
          `💵 R$ ${fmt(projectedRemaining)} de sobra`,
      };
    } else {
      return {
        canBuy: false,
        message:
          `❌ *Cuidado!* Essa compra pode comprometer seu mês.\n\n` +
          `Com R$ ${fmt(amount)} a mais, sua projeção seria *-R$ ${fmt(Math.abs(projectedRemaining))}* no vermelho.`,
      };
    }
  }

  async getMonthSummary(userConfigId: number): Promise<MonthlySummary> {
    return this.recalculate(userConfigId);
  }
}
