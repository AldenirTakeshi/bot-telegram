import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1774465216937 implements MigrationInterface {
    name = 'InitialSchema1774465216937'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "fixed_costs" ("id" SERIAL NOT NULL, "userConfigId" integer NOT NULL, "name" character varying NOT NULL, "amount" numeric(10,2) NOT NULL, "currentAmount" numeric(10,2), "isCreditCard" boolean NOT NULL DEFAULT false, "active" boolean NOT NULL DEFAULT true, "dayOfMonth" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d7af59c27ad8bd34cbf57808c52" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "daily_expenses" ("id" SERIAL NOT NULL, "userConfigId" integer NOT NULL, "category" character varying NOT NULL, "description" character varying, "amount" numeric(10,2) NOT NULL, "expenseDate" date NOT NULL DEFAULT ('now'::text)::date, "sourcePhone" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_01ca887c20e021509862f0bda0f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6d7bedf845fcc5e840a04bcc27" ON "daily_expenses" ("userConfigId", "expenseDate") `);
        await queryRunner.query(`CREATE TABLE "monthly_summaries" ("id" SERIAL NOT NULL, "userConfigId" integer NOT NULL, "month" character varying(7) NOT NULL, "spendingCeilingSnapshot" numeric(10,2) NOT NULL, "fixedCostsTotal" numeric(10,2) NOT NULL, "variableSpent" numeric(10,2) NOT NULL DEFAULT '0', "remaining" numeric(10,2) NOT NULL, "burnRatePercent" numeric(5,2) NOT NULL DEFAULT '0', "closedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_9c4b1a9e91ef37effe2f3daa731" UNIQUE ("userConfigId", "month"), CONSTRAINT "PK_bb6bca212bc8525e081c27f46d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_configs" ("id" SERIAL NOT NULL, "telegramChatId" character varying NOT NULL, "phoneSecondary" character varying, "incomeTotal" numeric(10,2) NOT NULL DEFAULT '0', "investmentGoal" numeric(10,2) NOT NULL DEFAULT '0', "spendingCeiling" numeric(10,2) NOT NULL DEFAULT '0', "onboardingCompleted" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1ee63168c3cef816bb005889b0c" UNIQUE ("telegramChatId"), CONSTRAINT "PK_fc11c8861af6469fbd8920e9f80" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "fixed_costs" ADD CONSTRAINT "FK_025af6eb89e8510fb85ef57c2ff" FOREIGN KEY ("userConfigId") REFERENCES "user_configs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "daily_expenses" ADD CONSTRAINT "FK_e233bfc87faa8d5920070fefcdc" FOREIGN KEY ("userConfigId") REFERENCES "user_configs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "monthly_summaries" ADD CONSTRAINT "FK_940f0ef925531e10d63db5c3c49" FOREIGN KEY ("userConfigId") REFERENCES "user_configs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "monthly_summaries" DROP CONSTRAINT "FK_940f0ef925531e10d63db5c3c49"`);
        await queryRunner.query(`ALTER TABLE "daily_expenses" DROP CONSTRAINT "FK_e233bfc87faa8d5920070fefcdc"`);
        await queryRunner.query(`ALTER TABLE "fixed_costs" DROP CONSTRAINT "FK_025af6eb89e8510fb85ef57c2ff"`);
        await queryRunner.query(`DROP TABLE "user_configs"`);
        await queryRunner.query(`DROP TABLE "monthly_summaries"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6d7bedf845fcc5e840a04bcc27"`);
        await queryRunner.query(`DROP TABLE "daily_expenses"`);
        await queryRunner.query(`DROP TABLE "fixed_costs"`);
    }

}
