import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppointmentsTable1749609600000 implements MigrationInterface {
  name = 'AddAppointmentsTable1749609600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."appointment_status_enum" AS ENUM(
        'BOOKED', 'CANCELLED'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "appointments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "date" date NOT NULL,
        "startTime" time NOT NULL,
        "endTime" time NOT NULL,
        "status" "public"."appointment_status_enum" NOT NULL DEFAULT 'BOOKED',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "doctorId" uuid,
        "patientId" uuid,
        CONSTRAINT "PK_appointments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD CONSTRAINT "FK_appointments_doctor"
      FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id")
      ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD CONSTRAINT "FK_appointments_patient"
      FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id")
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_appointments_patient"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_appointments_doctor"`);
    await queryRunner.query(`DROP TABLE "appointments"`);
    await queryRunner.query(`DROP TYPE "public"."appointment_status_enum"`);
  }
}