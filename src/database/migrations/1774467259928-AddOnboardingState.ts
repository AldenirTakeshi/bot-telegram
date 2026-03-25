import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOnboardingState1774467259928 implements MigrationInterface {
    name = 'AddOnboardingState1774467259928'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_configs" ADD "onboardingStep" character varying`);
        await queryRunner.query(`ALTER TABLE "user_configs" ADD "onboardingData" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_configs" DROP COLUMN "onboardingData"`);
        await queryRunner.query(`ALTER TABLE "user_configs" DROP COLUMN "onboardingStep"`);
    }

}
