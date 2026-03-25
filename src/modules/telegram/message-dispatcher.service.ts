import { Injectable, Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { OnboardingService } from './onboarding.service';
import { NlpService } from '../nlp/nlp.service';
import { UserConfigService } from '../user-config/user-config.service';
import { ExpensesService } from '../expenses/expenses.service';
import { FixedCostsService } from '../fixed-costs/fixed-costs.service';
import { SummaryService } from '../summary/summary.service';
import { BotMessages } from '../../common/constants/bot-messages';
import { ParsedIntent } from '../nlp/dto/parsed-intent.dto';
import { getCurrentMonth } from '../../common/helpers/format.helper';
import { RateLimiterService } from '../../common/services/rate-limiter.service';

export type { ParsedIntent };

@Injectable()
export class MessageDispatcherService {
  private readonly logger = new Logger(MessageDispatcherService.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly onboardingService: OnboardingService,
    private readonly nlpService: NlpService,
    private readonly userConfigService: UserConfigService,
    private readonly expensesService: ExpensesService,
    private readonly fixedCostsService: FixedCostsService,
    private readonly summaryService: SummaryService,
    private readonly rateLimiter: RateLimiterService,
  ) {
    this.registerBotHandlers();
  }

  private registerBotHandlers(): void {
    const bot = this.telegramService.bot;

    bot.command('start', async (ctx) => {
      const chatId = ctx.chat.id.toString();
      this.logger.log(`/start from chatId: ${chatId}`);
      await this.onboardingService.handleStart(chatId);
    });

    bot.command('help', async (ctx) => {
      await this.telegramService.sendMarkdown(ctx.chat.id, BotMessages.HELP_MENU);
    });

    bot.command('reset', async (ctx) => {
      const chatId = ctx.chat.id.toString();
      await bot.telegram.sendMessage(chatId,
        '⚠️ *Tem certeza?* Isso vai apagar *todos os seus dados*:\n\n• Gastos registrados\n• Gastos fixos\n• Resumos mensais\n• Configuração do perfil\n\nVocê precisará configurar tudo do zero.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Sim, apagar tudo', callback_data: 'confirm_reset' },
              { text: '❌ Cancelar', callback_data: 'cancel_reset' },
            ]],
          },
        },
      );
    });

    bot.action('confirm_reset', async (ctx) => {
      const chatId = ctx.chat?.id.toString();
      if (!chatId) return;
      await ctx.answerCbQuery();
      const user = await this.userConfigService.findByChatId(chatId);
      if (!user) {
        await ctx.editMessageText('❌ Usuário não encontrado.');
        return;
      }
      await this.expensesService.deleteAllByUser(user.id);
      await this.fixedCostsService.deleteAllByUser(user.id);
      await this.summaryService.deleteAllByUser(user.id);
      await this.userConfigService.resetUser(user.id);
      await ctx.editMessageText('✅ Dados apagados. Envie /start para configurar novamente.');
    });

    bot.action('cancel_reset', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageText('👍 Reset cancelado. Seus dados estão intactos.');
    });

    // Modo Casal: /parceiro <chatId> — authorizes a second phone
    bot.command('parceiro', async (ctx) => {
      const chatId = ctx.chat.id.toString();
      const args = ctx.message.text.split(' ').slice(1);
      const partnerChatId = args[0];

      if (!partnerChatId) {
        await this.telegramService.sendMarkdown(chatId, '❌ Use: `/parceiro <chatId_do_parceiro>`');
        return;
      }

      const user = await this.userConfigService.findByChatId(chatId);
      if (!user) {
        await this.telegramService.sendMarkdown(chatId, '❌ Você precisa configurar seu perfil primeiro. Envie /start');
        return;
      }

      await this.userConfigService.setSecondaryPhone(user.id, partnerChatId);
      await this.telegramService.sendMarkdown(
        chatId,
        `✅ *Modo Casal ativado!*\n\nChatId \`${partnerChatId}\` agora pode registrar gastos no seu teto.`,
      );
    });

    bot.on('text', async (ctx) => {
      const chatType = ctx.chat.type;
      const isGroup = chatType === 'group' || chatType === 'supergroup';
      const chatId = ctx.chat.id.toString();
      const text = ctx.message.text;
      const senderName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');

      this.logger.log(`Message from ${chatId} (${chatType}): "${text}"`);

      // Skip commands (handled by telegraf directly)
      if (text.startsWith('/')) return;

      // In groups, only process if the bot is mentioned or message starts with known patterns
      // (no restriction — all messages are processed, consistent with private chat behavior)

      // Rate limiting — use individual user id in groups to avoid one user blocking others
      const rateLimitKey = isGroup ? ctx.from.id.toString() : chatId;
      if (!this.rateLimiter.isAllowed(rateLimitKey)) {
        const secs = this.rateLimiter.secondsUntilReset(rateLimitKey);
        await this.telegramService.sendMarkdown(chatId, `⏳ Devagar! Aguarde ${secs}s antes de enviar outra mensagem.`);
        return;
      }

      try {
        // In groups: use group chatId as the account. In private: support Modo Casal lookup.
        const accountId = isGroup ? chatId : chatId;
        const user = isGroup
          ? await this.userConfigService.findByChatId(accountId)
          : await this.userConfigService.findByPhone(accountId);

        if (!user) {
          if (isGroup) {
            await this.telegramService.sendMarkdown(chatId, '👋 Grupo ainda não configurado! Um admin deve enviar /start aqui para configurar o orçamento compartilhado.');
          } else {
            await this.telegramService.sendMarkdown(chatId, '👋 Olá! Envie /start para configurar seu perfil.');
          }
          return;
        }

        // Onboarding wizard takes priority when active
        if (await this.onboardingService.isInOnboarding(user.telegramChatId)) {
          await this.onboardingService.handleOnboardingStep(user.telegramChatId, text);
          return;
        }

        // If onboarding not completed, redirect to /start
        if (!user.onboardingCompleted) {
          await this.telegramService.sendMarkdown(chatId, '👋 Configuração incompleta. Envie /start para começar.');
          return;
        }

        // NLP parsing
        const parsed = await this.nlpService.parse(text);
        this.logger.log(`Intent: ${parsed.intent} (confidence: ${parsed.confidence})`);

        if (parsed.confidence === 'low' && parsed.intent === 'UNKNOWN') {
          // In groups, ignore unknown messages to avoid spamming
          if (!isGroup) {
            await this.telegramService.sendMarkdown(chatId, BotMessages.UNKNOWN_COMMAND);
          }
          return;
        }

        // In groups: track member name as sourcePhone. In private: track Modo Casal.
        const sourcePhone = isGroup ? senderName : (chatId !== user.telegramChatId ? chatId : undefined);
        await this.dispatch(user.telegramChatId, parsed, user.id, sourcePhone);
      } catch (err) {
        this.logger.error(`Unhandled error processing message from ${chatId}:`, err);
        await this.telegramService.sendMarkdown(
          chatId,
          '😅 Ops! Algo deu errado. Tente novamente ou envie /help para ver os comandos.',
        );
      }
    });
  }

  async dispatch(
    chatId: string,
    parsedIntent: ParsedIntent,
    userConfigId: number,
    sourcePhone?: string,
  ): Promise<void> {
    this.logger.log(`Dispatching intent: ${parsedIntent.intent} for chatId: ${chatId}`);

    switch (parsedIntent.intent) {
      case 'REGISTER_EXPENSE':
        await this.handleRegisterExpense(chatId, parsedIntent, userConfigId, sourcePhone);
        break;

      case 'QUERY_BALANCE':
        await this.handleQueryBalance(chatId, userConfigId);
        break;

      case 'CAN_I_BUY':
        await this.handleCanIBuy(chatId, parsedIntent, userConfigId);
        break;

      case 'SETUP_CEILING':
        await this.handleSetupCeiling(chatId, parsedIntent, userConfigId);
        break;

      case 'ADD_FIXED':
        await this.handleAddFixed(chatId, parsedIntent, userConfigId);
        break;

      case 'UPDATE_CARD':
        await this.handleUpdateCard(chatId, parsedIntent, userConfigId);
        break;

      case 'MONTHLY_REPORT':
        await this.handleMonthlyReport(chatId, userConfigId);
        break;

      case 'LIST_EXPENSES':
        await this.handleListExpenses(chatId, parsedIntent, userConfigId);
        break;

      case 'LIST_FIXED':
        await this.handleListFixed(chatId, userConfigId);
        break;

      case 'DELETE_LAST':
        await this.handleDeleteLast(chatId, userConfigId);
        break;

      case 'DELETE_FIXED':
        await this.handleDeleteFixed(chatId, parsedIntent, userConfigId);
        break;

      case 'UPDATE_FIXED':
        await this.handleUpdateFixed(chatId, parsedIntent, userConfigId);
        break;

      case 'GREETING':
        await this.telegramService.sendMarkdown(chatId, BotMessages.GREETING);
        break;

      case 'UNKNOWN':
      default:
        await this.telegramService.sendMarkdown(chatId, BotMessages.UNKNOWN_COMMAND);
    }
  }

  private async handleRegisterExpense(
    chatId: string,
    intent: ParsedIntent,
    userConfigId: number,
    sourcePhone?: string,
  ): Promise<void> {
    if (!intent.amount) {
      await this.telegramService.sendMarkdown(chatId, BotMessages.PARSE_CONFIRM('o valor do gasto'));
      return;
    }

    const category = intent.category ?? 'Outros';
    await this.expensesService.register(userConfigId, {
      category,
      description: intent.description,
      amount: intent.amount,
      sourcePhone,
    });

    const summary = await this.summaryService.recalculate(userConfigId);
    const remaining = Number(summary.remaining);
    const burnRate = Number(summary.burnRatePercent);

    const registeredBy = sourcePhone && !sourcePhone.match(/^\d+$/) ? sourcePhone : undefined;
    await this.telegramService.sendMarkdown(
      chatId,
      BotMessages.EXPENSE_REGISTERED(category, intent.amount, remaining, registeredBy),
    );

    if (remaining < 0) {
      await this.telegramService.sendMarkdown(chatId, BotMessages.CEILING_ALERT_100(Math.abs(remaining)));
    } else if (burnRate >= 70) {
      // Alert at each 10% threshold crossed (70, 80, 90)
      const threshold = Math.floor(burnRate / 10) * 10;
      if (threshold >= 70) {
        await this.telegramService.sendMarkdown(chatId, BotMessages.CEILING_ALERT(burnRate, remaining));
      }
    }
  }

  private async handleQueryBalance(chatId: string, userConfigId: number): Promise<void> {
    const balance = await this.summaryService.getFormattedBalance(userConfigId);
    await this.telegramService.sendMarkdown(chatId, balance);
  }

  private async handleCanIBuy(chatId: string, intent: ParsedIntent, userConfigId: number): Promise<void> {
    if (!intent.amount) {
      await this.telegramService.sendMarkdown(chatId, '❌ Não consegui identificar o valor. Ex: "Posso comprar um tênis de *400*?"');
      return;
    }
    const result = await this.summaryService.projectCanBuy(userConfigId, intent.amount);
    await this.telegramService.sendMarkdown(chatId, result.message);
  }

  private async handleSetupCeiling(chatId: string, intent: ParsedIntent, userConfigId: number): Promise<void> {
    if (!intent.amount) {
      await this.telegramService.sendMarkdown(chatId, '❌ Não consegui identificar o valor. Ex: "Meu teto é *9500*"');
      return;
    }
    await this.userConfigService.updateConfig(userConfigId, { spendingCeiling: intent.amount });
    await this.summaryService.recalculate(userConfigId);
    await this.telegramService.sendMarkdown(chatId, BotMessages.CEILING_UPDATED(intent.amount));
  }

  private async handleAddFixed(chatId: string, intent: ParsedIntent, userConfigId: number): Promise<void> {
    if (!intent.fixedName || !intent.amount) {
      await this.telegramService.sendMarkdown(chatId, '❌ Formato inválido. Ex: "Aluguel 2000 todo dia 5"');
      return;
    }
    const isCreditCard = /cartão|card|nubank|itaú|bradesco|santander|inter|c6|xp/i.test(intent.fixedName);
    await this.fixedCostsService.create(userConfigId, {
      name: intent.fixedName,
      amount: intent.amount,
      isCreditCard,
      dayOfMonth: intent.dayOfMonth,
    });
    await this.telegramService.sendMarkdown(chatId, BotMessages.FIXED_ADDED(intent.fixedName, intent.amount));
  }

  private async handleUpdateCard(chatId: string, intent: ParsedIntent, userConfigId: number): Promise<void> {
    if (!intent.fixedName || !intent.amount) {
      await this.telegramService.sendMarkdown(chatId, '❌ Formato inválido. Ex: "Cartão Nubank mais 150"');
      return;
    }
    try {
      const updated = await this.fixedCostsService.updateCardAmount(userConfigId, intent.fixedName, intent.amount);
      await this.telegramService.sendMarkdown(chatId, BotMessages.CARD_UPDATED(updated.name, Number(updated.currentAmount)));
    } catch {
      await this.telegramService.sendMarkdown(
        chatId,
        `❌ Cartão *${intent.fixedName}* não encontrado. Verifique o nome e tente novamente.`,
      );
    }
  }

  private async handleListExpenses(chatId: string, intent: ParsedIntent, userConfigId: number): Promise<void> {
    const period = intent.period ?? 'today';

    const expenses = period === 'week'
      ? await this.expensesService.listThisWeek(userConfigId)
      : period === 'all'
        ? await this.expensesService.listThisMonth(userConfigId)
        : await this.expensesService.listToday(userConfigId);

    if (!expenses.length) {
      await this.telegramService.sendMarkdown(chatId, BotMessages.LIST_EXPENSES_EMPTY(period));
      return;
    }

    if (period === 'all') {
      const mapped = expenses.map((e) => ({
        category: e.category,
        amount: Number(e.amount),
        description: e.description,
        date: new Date(e.expenseDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      }));
      const total = mapped.reduce((s, e) => s + e.amount, 0);
      const lines = mapped.map((e) => `• ${e.date} *${e.category}*${e.description ? ` (${e.description})` : ''}: R$ ${e.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      const chunks = this.splitIntoChunks(lines, 30);
      for (const chunk of chunks) {
        await this.telegramService.sendMarkdown(chatId, chunk.join('\n'));
      }
      await this.telegramService.sendMarkdown(chatId, `💸 *Total do mês: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*`);
      return;
    }

    const mapped = expenses.map((e) => ({
      category: e.category,
      amount: Number(e.amount),
      description: e.description,
    }));
    await this.telegramService.sendMarkdown(chatId, BotMessages.LIST_EXPENSES(mapped, period));
  }

  private splitIntoChunks(lines: string[], size: number): string[][] {
    const chunks: string[][] = [];
    for (let i = 0; i < lines.length; i += size) {
      chunks.push(lines.slice(i, i + size));
    }
    return chunks;
  }

  private async handleListFixed(chatId: string, userConfigId: number): Promise<void> {
    const costs = await this.fixedCostsService.findAllActive(userConfigId);
    await this.telegramService.sendMarkdown(chatId, this.fixedCostsService.formatFixedList(costs));
  }

  private async handleDeleteLast(chatId: string, userConfigId: number): Promise<void> {
    const deleted = await this.expensesService.deleteLastExpense(userConfigId);
    if (!deleted) {
      await this.telegramService.sendMarkdown(chatId, BotMessages.DELETE_LAST_EMPTY);
      return;
    }
    await this.summaryService.recalculate(userConfigId);
    await this.telegramService.sendMarkdown(
      chatId,
      BotMessages.DELETE_LAST_SUCCESS(deleted.category, Number(deleted.amount)),
    );
  }

  private async handleDeleteFixed(chatId: string, intent: ParsedIntent, userConfigId: number): Promise<void> {
    if (!intent.fixedName) {
      await this.telegramService.sendMarkdown(chatId, '❌ Informe o nome do fixo. Ex: "remover Aluguel"');
      return;
    }
    const deleted = await this.fixedCostsService.deleteByName(userConfigId, intent.fixedName);
    if (!deleted) {
      await this.telegramService.sendMarkdown(chatId, `❌ Gasto fixo *${intent.fixedName}* não encontrado. Envie "quais são meus fixos?" para ver a lista.`);
      return;
    }
    await this.summaryService.recalculate(userConfigId);
    await this.telegramService.sendMarkdown(chatId, `✅ *${deleted.name}* removido dos seus gastos fixos.`);
  }

  private async handleUpdateFixed(chatId: string, intent: ParsedIntent, userConfigId: number): Promise<void> {
    if (!intent.fixedName || !intent.amount) {
      await this.telegramService.sendMarkdown(chatId, '❌ Formato inválido. Ex: "alterar Aluguel 2200"');
      return;
    }
    const updated = await this.fixedCostsService.updateAmount(userConfigId, intent.fixedName, intent.amount);
    if (!updated) {
      await this.telegramService.sendMarkdown(chatId, `❌ Gasto fixo *${intent.fixedName}* não encontrado. Envie "quais são meus fixos?" para ver a lista.`);
      return;
    }
    await this.summaryService.recalculate(userConfigId);
    await this.telegramService.sendMarkdown(chatId, `✅ *${updated.name}* atualizado para R$ ${Number(updated.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`);
  }

  private async handleMonthlyReport(chatId: string, userConfigId: number): Promise<void> {
    const summary = await this.summaryService.recalculate(userConfigId);
    const month = getCurrentMonth();
    const categories = await this.expensesService.getSpentByCategory(userConfigId, month);

    const report = BotMessages.MONTHLY_REPORT(
      month,
      Number(summary.spendingCeilingSnapshot),
      Number(summary.fixedCostsTotal),
      Number(summary.variableSpent),
      Number(summary.remaining),
      categories,
    );

    await this.telegramService.sendMarkdown(chatId, report);
  }
}
