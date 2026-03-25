import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyExpense } from './entities/daily-expense.entity';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [TypeOrmModule.forFeature([DailyExpense])],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
