import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationsTable1750000000000 implements MigrationInterface {
  name = 'AddNotificationsTable1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."notification_type_enum" AS ENUM(
        'APPOINTMENT_BOOKED',
        'APPOINTMENT_CANCELLED',
        'APPOINTMENT_RESCHEDULED',
        'APPOINTMENT_REMINDER',
        'FOLLOW_UP_REMINDER'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying NOT NULL,
        "message" text NOT NULL,
        "type" "public"."notification_type_enum" NOT NULL,
        "isRead" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "patientId" uuid,
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "notifications"
      ADD CONSTRAINT "FK_notifications_patient"
      FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id")
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_patient"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notification_type_enum"`);
  }
}