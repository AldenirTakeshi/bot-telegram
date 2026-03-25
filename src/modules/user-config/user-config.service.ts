import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserConfig } from './entities/user-config.entity';
import { UpdateUserConfigDto } from './dto/update-user-config.dto';

@Injectable()
export class UserConfigService {
  constructor(
    @InjectRepository(UserConfig)
    private readonly repo: Repository<UserConfig>,
  ) {}

  async findByChatId(chatId: string): Promise<UserConfig | null> {
    return this.repo.findOne({ where: { telegramChatId: chatId } });
  }

  async findByPhone(phone: string): Promise<UserConfig | null> {
    return this.repo.findOne({
      where: [{ telegramChatId: phone }, { phoneSecondary: phone }],
    });
  }

  async create(chatId: string): Promise<UserConfig> {
    const entity = this.repo.create({
      telegramChatId: chatId,
      incomeTotal: 0,
      investmentGoal: 0,
      spendingCeiling: 0,
      onboardingCompleted: false,
    });
    return this.repo.save(entity);
  }

  async updateConfig(id: number, dto: UpdateUserConfigDto): Promise<UserConfig> {
    await this.repo.update(id, dto);
    return this.repo.findOneOrFail({ where: { id } });
  }

  async setSecondaryPhone(id: number, phone: string): Promise<void> {
    await this.repo.update(id, { phoneSecondary: phone });
  }

  async completeOnboarding(id: number): Promise<void> {
    await this.repo.update(id, { onboardingCompleted: true, onboardingStep: null, onboardingData: null });
  }

  async saveOnboardingState(id: number, step: string, data: Record<string, unknown>): Promise<void> {
    await this.repo.update(id, { onboardingStep: step, onboardingData: data as any });
  }

  async clearOnboardingState(id: number): Promise<void> {
    await this.repo.update(id, { onboardingStep: null, onboardingData: null });
  }

  async findById(id: number): Promise<UserConfig> {
    return this.repo.findOneOrFail({ where: { id } });
  }

  async findAllActive(): Promise<UserConfig[]> {
    return this.repo.find({ where: { onboardingCompleted: true } });
  }
}
