import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyExpense } from './entities/daily-expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';

export interface CategorySpend {
  category: string;
  total: number;
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(DailyExpense)
    private readonly repo: Repository<DailyExpense>,
  ) {}

  async register(userConfigId: number, dto: CreateExpenseDto): Promise<DailyExpense> {
    const entity = this.repo.create({
      userConfigId,
      category: dto.category,
      description: dto.description ?? null,
      amount: dto.amount,
      sourcePhone: dto.sourcePhone ?? null,
      expenseDate: new Date(),
    });
    return this.repo.save(entity);
  }

  async getTotalVariableSpentThisMonth(userConfigId: number): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const result = await this.repo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'total')
      .where('e.userConfigId = :userConfigId', { userConfigId })
      .andWhere('e.expenseDate >= :start', { start: startOfMonth })
      .andWhere('e.expenseDate <= :end', { end: endOfMonth })
      .getRawOne<{ total: string }>();

    return parseFloat(result?.total ?? '0');
  }

  async getSpentByCategory(userConfigId: number, month: string): Promise<CategorySpend[]> {
    const [year, monthNum] = month.split('-').map(Number);
    const startOfMonth = new Date(year, monthNum - 1, 1);
    const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59);

    const rows = await this.repo
      .createQueryBuilder('e')
      .select('e.category', 'category')
      .addSelect('SUM(e.amount)', 'total')
      .where('e.userConfigId = :userConfigId', { userConfigId })
      .andWhere('e.expenseDate >= :start', { start: startOfMonth })
      .andWhere('e.expenseDate <= :end', { end: endOfMonth })
      .groupBy('e.category')
      .orderBy('total', 'DESC')
      .getRawMany<{ category: string; total: string }>();

    return rows.map((r) => ({ category: r.category, total: parseFloat(r.total) }));
  }

  async listToday(userConfigId: number): Promise<DailyExpense[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.repo.find({
      where: { userConfigId },
      order: { createdAt: 'DESC' },
    }).then((all) =>
      all.filter((e) => {
        const d = new Date(e.expenseDate);
        return d >= today && d < tomorrow;
      }),
    );
  }

  async listThisWeek(userConfigId: number): Promise<DailyExpense[]> {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    return this.repo.find({
      where: { userConfigId },
      order: { createdAt: 'DESC' },
    }).then((all) =>
      all.filter((e) => new Date(e.expenseDate) >= weekAgo),
    );
  }

  async deleteLastExpense(userConfigId: number): Promise<DailyExpense | null> {
    const last = await this.repo.findOne({
      where: { userConfigId },
      order: { createdAt: 'DESC' },
    });
    if (!last) return null;
    await this.repo.remove(last);
    return last;
  }

  async deleteAllByUser(userConfigId: number): Promise<void> {
    await this.repo.delete({ userConfigId });
  }

  async getDailyAverage(userConfigId: number, days: number): Promise<number> {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    const result = await this.repo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'total')
      .where('e.userConfigId = :userConfigId', { userConfigId })
      .andWhere('e.expenseDate >= :start', { start })
      .andWhere('e.expenseDate <= :end', { end })
      .getRawOne<{ total: string }>();

    const total = parseFloat(result?.total ?? '0');
    return total / days;
  }
}
