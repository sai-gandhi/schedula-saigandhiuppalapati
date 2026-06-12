import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSlotsTable1749523200000 implements MigrationInterface {
  name = 'AddSlotsTable1749523200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."slot_status_enum" AS ENUM(
        'AVAILABLE', 'BOOKED', 'CANCELLED'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "slots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "date" date NOT NULL,
        "startTime" time NOT NULL,
        "endTime" time NOT NULL,
        "status" "public"."slot_status_enum" NOT NULL DEFAULT 'AVAILABLE',
        "duration" integer NOT NULL DEFAULT 30,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "doctorId" uuid,
        CONSTRAINT "PK_slots" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "slots"
      ADD CONSTRAINT "FK_slots_doctor"
      FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id")
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "slots" DROP CONSTRAINT "FK_slots_doctor"`);
    await queryRunner.query(`DROP TABLE "slots"`);
    await queryRunner.query(`DROP TYPE "public"."slot_status_enum"`);
  }
}