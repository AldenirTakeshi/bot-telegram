import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FixedCost } from './entities/fixed-cost.entity';
import { FixedCostsService } from './fixed-costs.service';

@Module({
  imports: [TypeOrmModule.forFeature([FixedCost])],
  providers: [FixedCostsService],
  exports: [FixedCostsService],
})
export class FixedCostsModule {}
