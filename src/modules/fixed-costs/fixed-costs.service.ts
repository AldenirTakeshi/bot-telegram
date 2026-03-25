import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FixedCost } from './entities/fixed-cost.entity';
import { CreateFixedCostDto } from './dto/create-fixed-cost.dto';

@Injectable()
export class FixedCostsService {
  constructor(
    @InjectRepository(FixedCost)
    private readonly repo: Repository<FixedCost>,
  ) {}

  async findAllActive(userConfigId: number): Promise<FixedCost[]> {
    return this.repo.find({ where: { userConfigId, active: true } });
  }

  async deleteAllByUser(userConfigId: number): Promise<void> {
    await this.repo.delete({ userConfigId });
  }

  async create(userConfigId: number, dto: CreateFixedCostDto): Promise<FixedCost> {
    const entity = this.repo.create({
      userConfigId,
      name: dto.name,
      amount: dto.amount,
      isCreditCard: dto.isCreditCard,
      currentAmount: dto.isCreditCard ? 0 : null,
      dayOfMonth: dto.dayOfMonth ?? null,
      active: true,
    });
    return this.repo.save(entity);
  }

  formatFixedList(costs: FixedCost[]): string {
    if (!costs.length) return '📭 Nenhum gasto fixo cadastrado.';
    const lines = costs.map((c) => {
      const value = c.isCreditCard
        ? `R$ ${Number(c.currentAmount ?? c.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (fatura atual)`
        : `R$ ${Number(c.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      const day = c.dayOfMonth ? ` • dia ${c.dayOfMonth}` : '';
      const tag = c.isCreditCard ? ' 💳' : '';
      return `• *${c.name}*${tag}: ${value}${day}`;
    });
    return `📋 *Seus gastos fixos:*\n\n${lines.join('\n')}`;
  }

  async getTotalFixed(userConfigId: number): Promise<number> {
    const costs = await this.findAllActive(userConfigId);
    return costs.reduce((sum, c) => {
      const value = c.isCreditCard ? Number(c.currentAmount ?? c.amount) : Number(c.amount);
      return sum + value;
    }, 0);
  }

  async updateCardAmount(
    userConfigId: number,
    name: string,
    increment: number,
  ): Promise<FixedCost> {
    const card = await this.repo.findOne({
      where: { userConfigId, isCreditCard: true, active: true, name },
    });

    if (!card) {
      // If card not found by exact name, try partial match
      const cards = await this.repo.find({ where: { userConfigId, isCreditCard: true, active: true } });
      const match = cards.find((c) => c.name.toLowerCase().includes(name.toLowerCase()));
      if (!match) throw new Error(`Credit card "${name}" not found`);
      match.currentAmount = Number(match.currentAmount ?? 0) + increment;
      return this.repo.save(match);
    }

    card.currentAmount = Number(card.currentAmount ?? 0) + increment;
    return this.repo.save(card);
  }
}
