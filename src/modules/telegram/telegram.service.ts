import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  readonly bot: Telegraf;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not defined');
    }
    this.bot = new Telegraf(token);
  }

  async onModuleInit(): Promise<void> {
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    if (nodeEnv === 'production') {
      const webhookUrl = this.configService.get<string>('TELEGRAM_WEBHOOK_URL');
      if (!webhookUrl) {
        throw new Error('TELEGRAM_WEBHOOK_URL is required in production');
      }
      await this.bot.telegram.setWebhook(`${webhookUrl}/webhook`);
      this.logger.log(`Webhook set to ${webhookUrl}/webhook`);
    } else {
      this.bot.launch().catch((err) => this.logger.error('Bot launch error', err));
      this.logger.log('Bot started in polling mode (development)');
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.bot.stop('SIGTERM');
  }

  async sendMessage(chatId: number | string, text: string): Promise<void> {
    await this.bot.telegram.sendMessage(chatId, text);
  }

  async sendMarkdown(chatId: number | string, text: string): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (err) {
      this.logger.error(`sendMarkdown failed for chatId ${chatId}:`, err);
      // Fallback: send as plain text if Markdown fails
      try {
        await this.bot.telegram.sendMessage(chatId, text.replace(/[*_`]/g, ''));
      } catch (fallbackErr) {
        this.logger.error(`Plain text fallback also failed for chatId ${chatId}:`, fallbackErr);
      }
    }
  }
}
