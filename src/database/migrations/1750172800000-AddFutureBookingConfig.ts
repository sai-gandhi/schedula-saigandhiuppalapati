import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFutureBookingConfig1750172800000 implements MigrationInterface {
  name = 'AddFutureBookingConfig1750172800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_profiles"
      ADD "allowFutureBooking" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "doctor_profiles"
      ADD "maxFutureBookingDays" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_profiles"
      DROP COLUMN "maxFutureBookingDays"
    `);
    await queryRunner.query(`
      ALTER TABLE "doctor_profiles"
      DROP COLUMN "allowFutureBooking"
    `);
  }
}