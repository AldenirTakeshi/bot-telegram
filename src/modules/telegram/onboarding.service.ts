import { Injectable, Logger } from '@nestjs/common';
import { UserConfigService } from '../user-config/user-config.service';
import { FixedCostsService } from '../fixed-costs/fixed-costs.service';
import { SummaryService } from '../summary/summary.service';
import { TelegramService } from './telegram.service';
import { BotMessages } from '../../common/constants/bot-messages';

const STEPS = {
  AWAITING_INCOME: 'AWAITING_INCOME',
  AWAITING_INVESTMENT: 'AWAITING_INVESTMENT',
  AWAITING_FIXED_COSTS: 'AWAITING_FIXED_COSTS',
  COMPLETED: 'COMPLETED',
} as const;

type OnboardingStep = typeof STEPS[keyof typeof STEPS];

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly userConfigService: UserConfigService,
    private readonly fixedCostsService: FixedCostsService,
    private readonly summaryService: SummaryService,
    private readonly telegramService: TelegramService,
  ) {}

  async isInOnboarding(chatId: string): Promise<boolean> {
    const user = await this.userConfigService.findByChatId(chatId);
    if (!user || user.onboardingCompleted) return false;
    return !!user.onboardingStep;
  }

  async handleStart(chatId: string): Promise<void> {
    let user = await this.userConfigService.findByChatId(chatId);

    if (user?.onboardingCompleted) {
      const balance = await this.summaryService.getFormattedBalance(user.id);
      await this.telegramService.sendMarkdown(chatId, `Bem-vindo de volta! 👋\n\n${balance}`);
      return;
    }

    if (!user) {
      user = await this.userConfigService.create(chatId);
    }

    await this.userConfigService.saveOnboardingState(user.id, STEPS.AWAITING_INCOME, {});
    await this.telegramService.sendMarkdown(chatId, BotMessages.WELCOME);
  }

  async handleOnboardingStep(chatId: string, text: string): Promise<boolean> {
    const user = await this.userConfigService.findByChatId(chatId);
    if (!user || !user.onboardingStep || user.onboardingCompleted) return false;

    const step = user.onboardingStep as OnboardingStep;
    const data = (user.onboardingData ?? {}) as Record<string, unknown>;

    switch (step) {
      case STEPS.AWAITING_INCOME:
        return this.handleIncome(chatId, text, user.id, data);
      case STEPS.AWAITING_INVESTMENT:
        return this.handleInvestment(chatId, text, user.id, data);
      case STEPS.AWAITING_FIXED_COSTS:
        return this.handleFixedCost(chatId, text, user.id, data);
      default:
        return false;
    }
  }

  private parseAmount(text: string): number | null {
    const cleaned = text.trim().replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    const value = parseFloat(cleaned);
    return isNaN(value) || value <= 0 ? null : value;
  }

  private async handleIncome(
    chatId: string, text: string, userId: number, data: Record<string, unknown>,
  ): Promise<boolean> {
    const income = this.parseAmount(text);
    if (!income) {
      await this.telegramService.sendMarkdown(chatId, '❌ Valor inválido. Digite apenas o número. Ex: *10500*');
      return true;
    }
    await this.userConfigService.saveOnboardingState(userId, STEPS.AWAITING_INVESTMENT, { ...data, income });
    await this.telegramService.sendMarkdown(chatId, BotMessages.ONBOARDING_INVESTMENT(income));
    return true;
  }

  private async handleInvestment(
    chatId: string, text: string, userId: number, data: Record<string, unknown>,
  ): Promise<boolean> {
    const investment = this.parseAmount(text);
    if (!investment) {
      await this.telegramService.sendMarkdown(chatId, '❌ Valor inválido. Digite apenas o número. Ex: *1000*');
      return true;
    }
    const income = data.income as number;
    const ceiling = income - investment;
    if (ceiling <= 0) {
      await this.telegramService.sendMarkdown(chatId, `❌ Investimento maior que a renda. Tente um valor menor.`);
      return true;
    }
    await this.userConfigService.updateConfig(userId, { incomeTotal: income, investmentGoal: investment, spendingCeiling: ceiling });
    await this.userConfigService.saveOnboardingState(userId, STEPS.AWAITING_FIXED_COSTS, { income, investment, ceiling });
    await this.telegramService.sendMarkdown(chatId, BotMessages.ONBOARDING_CEILING_CONFIRM(income, investment, ceiling));
    return true;
  }

  private async handleFixedCost(
    chatId: string, text: string, userId: number, data: Record<string, unknown>,
  ): Promise<boolean> {
    const normalized = text.trim().toLowerCase();

    if (normalized === 'pronto' || normalized === 'ok' || normalized === 'finalizar') {
      return this.finishOnboarding(chatId, userId, data);
    }

    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const added: string[] = [];
    const failed: string[] = [];

    for (const line of lines) {
      const match = line.match(/^(.+?)\s+([\d.,]+)(?:\s+(?:dia|todo dia|dia\s+)?(\d+))?$/i);
      if (!match) {
        failed.push(line);
        continue;
      }
      const name = match[1].trim();
      const amount = this.parseAmount(match[2]);
      const dayOfMonth = match[3] ? parseInt(match[3]) : undefined;
      if (!amount) {
        failed.push(line);
        continue;
      }
      const isCreditCard = /cartão|card|nubank|itaú|bradesco|santander|inter|c6|xp/i.test(name);
      await this.fixedCostsService.create(userId, { name, amount, isCreditCard, dayOfMonth });
      added.push(`• *${name}*: R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    }

    if (added.length > 0) {
      const msg = `✅ Adicionado${added.length > 1 ? 's' : ''}:\n${added.join('\n')}\n\nDigite mais fixos ou envie *pronto* para finalizar.`;
      await this.telegramService.sendMarkdown(chatId, msg);
    }

    if (failed.length > 0) {
      const msg = `❌ Não entendi ${failed.length > 1 ? 'estas linhas' : 'esta linha'}:\n${failed.map((f) => `• ${f}`).join('\n')}\n\nUse o formato: *Nome Valor* (ex: Aluguel 2000)`;
      await this.telegramService.sendMarkdown(chatId, msg);
    }

    return true;
  }

  private async finishOnboarding(chatId: string, userId: number, data: Record<string, unknown>): Promise<boolean> {
    const costs = await this.fixedCostsService.findAllActive(userId);
    const fixedTotal = costs.reduce((s, c) => s + Number(c.amount), 0);
    const ceiling = data.ceiling as number;
    const freeBalance = ceiling - fixedTotal;

    await this.userConfigService.completeOnboarding(userId);
    await this.telegramService.sendMarkdown(chatId, BotMessages.ONBOARDING_COMPLETE(ceiling, fixedTotal, freeBalance));
    return true;
  }
}
