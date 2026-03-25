import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserConfig } from './entities/user-config.entity';
import { UserConfigService } from './user-config.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserConfig])],
  providers: [UserConfigService],
  exports: [UserConfigService],
})
export class UserConfigModule {}
