import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchedulingFields1749696000000 implements MigrationInterface {
  name = 'AddSchedulingFields1749696000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."doctor_profiles_schedulingtype_enum" AS ENUM('STREAM', 'WAVE')
    `);
    await queryRunner.query(`
      ALTER TABLE "doctor_profiles"
      ADD "schedulingType" "public"."doctor_profiles_schedulingtype_enum" NOT NULL DEFAULT 'STREAM'
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."slots_slottype_enum" AS ENUM('STREAM', 'WAVE')
    `);
    await queryRunner.query(`
      ALTER TABLE "slots"
      ADD "slotType" "public"."slots_slottype_enum" NOT NULL DEFAULT 'STREAM'
    `);
    await queryRunner.query(`ALTER TABLE "slots" ADD "maxCapacity" integer`);
    await queryRunner.query(`ALTER TABLE "slots" ADD "bookedCount" integer NOT NULL DEFAULT 0`);

    await queryRunner.query(`ALTER TABLE "appointments" ADD "schedulingType" character varying`);
    await queryRunner.query(`ALTER TABLE "appointments" ADD "tokenNumber" integer`);
    await queryRunner.query(`ALTER TABLE "appointments" ADD "slotId" uuid`);
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD CONSTRAINT "FK_appointments_slot"
      FOREIGN KEY ("slotId") REFERENCES "slots"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_appointments_slot"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "slotId"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "tokenNumber"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "schedulingType"`);
    await queryRunner.query(`ALTER TABLE "slots" DROP COLUMN "bookedCount"`);
    await queryRunner.query(`ALTER TABLE "slots" DROP COLUMN "maxCapacity"`);
    await queryRunner.query(`ALTER TABLE "slots" DROP COLUMN "slotType"`);
    await queryRunner.query(`DROP TYPE "public"."slots_slottype_enum"`);
    await queryRunner.query(`ALTER TABLE "doctor_profiles" DROP COLUMN "schedulingType"`);
    await queryRunner.query(`DROP TYPE "public"."doctor_profiles_schedulingtype_enum"`);
  }
}