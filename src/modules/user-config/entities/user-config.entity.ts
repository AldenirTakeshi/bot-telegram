import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FixedCost } from '../../fixed-costs/entities/fixed-cost.entity';
import { DailyExpense } from '../../expenses/entities/daily-expense.entity';
import { MonthlySummary } from '../../summary/entities/monthly-summary.entity';

@Entity('user_configs')
export class UserConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  telegramChatId: string;

  @Column({ nullable: true, type: 'varchar' })
  phoneSecondary: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  incomeTotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  investmentGoal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  spendingCeiling: number;

  @Column({ default: false })
  onboardingCompleted: boolean;

  @Column({ nullable: true, type: 'varchar' })
  onboardingStep: string | null;

  @Column({ nullable: true, type: 'jsonb' })
  onboardingData: Record<string, unknown> | null;

  @OneToMany(() => FixedCost, (fixedCost) => fixedCost.userConfig)
  fixedCosts: FixedCost[];

  @OneToMany(() => DailyExpense, (expense) => expense.userConfig)
  dailyExpenses: DailyExpense[];

  @OneToMany(() => MonthlySummary, (summary) => summary.userConfig)
  monthlySummaries: MonthlySummary[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
