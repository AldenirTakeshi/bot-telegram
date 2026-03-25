import { Body, Controller, Post } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { MessageDispatcherService } from './message-dispatcher.service';

@Controller('webhook')
export class TelegramController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly messageDispatcher: MessageDispatcherService,
  ) {}

  @Post()
  async handleWebhook(@Body() body: any): Promise<void> {
    await this.telegramService.bot.handleUpdate(body);
  }
}
