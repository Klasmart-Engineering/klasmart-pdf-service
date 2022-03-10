import {MigrationInterface, QueryRunner} from "typeorm";

export class pdfMetadata1644907290365 implements MigrationInterface {
    name = 'pdfMetadata1644907290365'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pdf_metadata" ADD COLUMN IF NOT EXISTS "outline" jsonb`);
        await queryRunner.query(`ALTER TABLE "pdf_metadata" ADD COLUMN IF NOT EXISTS "pageLabels" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pdf_metadata" DROP COLUMN "pageLabels"`);
        await queryRunner.query(`ALTER TABLE "pdf_metadata" DROP COLUMN "outline"`);
    }

}
