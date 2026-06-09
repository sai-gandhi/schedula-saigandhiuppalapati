import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsAvailableToDoctor1749350400000 implements MigrationInterface {
  name = 'AddIsAvailableToDoctor1749350400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_profiles"
      ADD COLUMN IF NOT EXISTS "isAvailable" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_profiles"
      DROP COLUMN "isAvailable"
    `);
  }
}