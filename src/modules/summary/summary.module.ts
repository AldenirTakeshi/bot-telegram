import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonthlySummary } from './entities/monthly-summary.entity';
import { SummaryService } from './summary.service';
import { ExpensesModule } from '../expenses/expenses.module';
import { FixedCostsModule } from '../fixed-costs/fixed-costs.module';
import { UserConfigModule } from '../user-config/user-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MonthlySummary]),
    ExpensesModule,
    FixedCostsModule,
    UserConfigModule,
  ],
  providers: [SummaryService],
  exports: [SummaryService],
})
export class SummaryModule {}
