import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1749264000000 implements MigrationInterface {
  name = 'InitSchema1749264000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."users_role_enum" AS ENUM('DOCTOR', 'PATIENT')
    `);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "role" "public"."users_role_enum" NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "doctor_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fullName" character varying NOT NULL,
        "specialization" character varying NOT NULL,
        "experience" character varying NOT NULL,
        "qualification" character varying NOT NULL,
        "consultationFee" numeric(10,2) NOT NULL,
        "availabilityHours" character varying NOT NULL,
        "profileDetails" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" uuid,
        CONSTRAINT "REL_doctor_user" UNIQUE ("userId"),
        CONSTRAINT "PK_doctor_profiles" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "patient_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fullName" character varying NOT NULL,
        "age" integer NOT NULL,
        "gender" character varying NOT NULL,
        "contactDetails" character varying NOT NULL,
        "healthInfo" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" uuid,
        CONSTRAINT "REL_patient_user" UNIQUE ("userId"),
        CONSTRAINT "PK_patient_profiles" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "doctor_profiles"
      ADD CONSTRAINT "FK_doctor_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "patient_profiles"
      ADD CONSTRAINT "FK_patient_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "patient_profiles" DROP CONSTRAINT "FK_patient_user"`);
    await queryRunner.query(`ALTER TABLE "doctor_profiles" DROP CONSTRAINT "FK_doctor_user"`);
    await queryRunner.query(`DROP TABLE "patient_profiles"`);
    await queryRunner.query(`DROP TABLE "doctor_profiles"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}