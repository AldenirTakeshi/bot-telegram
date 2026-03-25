import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserConfig } from '../../user-config/entities/user-config.entity';

@Entity('daily_expenses')
@Index(['userConfigId', 'expenseDate'])
export class DailyExpense {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userConfigId: number;

  @Column()
  category: string;

  @Column({ nullable: true, type: 'varchar' })
  description: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  expenseDate: Date;

  @Column({ nullable: true, type: 'varchar' })
  sourcePhone: string | null;

  @ManyToOne(() => UserConfig, (userConfig) => userConfig.dailyExpenses)
  @JoinColumn({ name: 'userConfigId' })
  userConfig: UserConfig;

  @CreateDateColumn()
  createdAt: Date;
}
