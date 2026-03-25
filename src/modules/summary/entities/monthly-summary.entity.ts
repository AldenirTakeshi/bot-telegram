import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UserConfig } from '../../user-config/entities/user-config.entity';

@Entity('monthly_summaries')
@Unique(['userConfigId', 'month'])
export class MonthlySummary {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userConfigId: number;

  @Column({ type: 'varchar', length: 7 })
  month: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  spendingCeilingSnapshot: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  fixedCostsTotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  variableSpent: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  remaining: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  burnRatePercent: number;

  @Column({ nullable: true, type: 'timestamp' })
  closedAt: Date | null;

  @ManyToOne(() => UserConfig, (userConfig) => userConfig.monthlySummaries)
  @JoinColumn({ name: 'userConfigId' })
  userConfig: UserConfig;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
