import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDoctorLeavesTable1750259200000 implements MigrationInterface {
  name = 'AddDoctorLeavesTable1750259200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "doctor_leaves" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "leaveDate" date NOT NULL,
        "reason" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "doctorId" uuid,
        CONSTRAINT "PK_doctor_leaves" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "doctor_leaves"
      ADD CONSTRAINT "FK_doctor_leaves_doctor"
      FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id")
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "doctor_leaves" DROP CONSTRAINT "FK_doctor_leaves_doctor"`);
    await queryRunner.query(`DROP TABLE "doctor_leaves"`);
  }
}