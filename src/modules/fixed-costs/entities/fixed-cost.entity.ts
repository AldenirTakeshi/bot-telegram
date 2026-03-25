import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserConfig } from '../../user-config/entities/user-config.entity';

@Entity('fixed_costs')
export class FixedCost {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userConfigId: number;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  currentAmount: number | null;

  @Column({ default: false })
  isCreditCard: boolean;

  @Column({ default: true })
  active: boolean;

  @Column({ nullable: true, type: 'int' })
  dayOfMonth: number | null;

  @ManyToOne(() => UserConfig, (userConfig) => userConfig.fixedCosts)
  @JoinColumn({ name: 'userConfigId' })
  userConfig: UserConfig;

  @CreateDateColumn()
  createdAt: Date;
}
