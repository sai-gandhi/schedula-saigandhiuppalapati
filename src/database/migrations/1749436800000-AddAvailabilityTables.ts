import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvailabilityTables1749436800000 implements MigrationInterface {
  name = 'AddAvailabilityTables1749436800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."day_of_week_enum" AS ENUM(
        'MONDAY', 'TUESDAY', 'WEDNESDAY',
        'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "recurring_availability" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "dayOfWeek" "public"."day_of_week_enum" NOT NULL,
        "startTime" time NOT NULL,
        "endTime" time NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "doctorId" uuid,
        CONSTRAINT "PK_recurring_availability" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "custom_availability" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "date" date NOT NULL,
        "startTime" time,
        "endTime" time,
        "isUnavailable" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "doctorId" uuid,
        CONSTRAINT "PK_custom_availability" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "recurring_availability"
      ADD CONSTRAINT "FK_recurring_doctor"
      FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id")
      ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "custom_availability"
      ADD CONSTRAINT "FK_custom_doctor"
      FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id")
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "custom_availability" DROP CONSTRAINT "FK_custom_doctor"`);
    await queryRunner.query(`ALTER TABLE "recurring_availability" DROP CONSTRAINT "FK_recurring_doctor"`);
    await queryRunner.query(`DROP TABLE "custom_availability"`);
    await queryRunner.query(`DROP TABLE "recurring_availability"`);
    await queryRunner.query(`DROP TYPE "public"."day_of_week_enum"`);
  }
}