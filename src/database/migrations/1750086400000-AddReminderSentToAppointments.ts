import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReminderSentToAppointments1750086400000 implements MigrationInterface {
  name = 'AddReminderSentToAppointments1750086400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD "reminderSent" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
      DROP COLUMN "reminderSent"
    `);
  }
}