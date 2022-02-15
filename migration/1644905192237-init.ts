import {MigrationInterface, QueryRunner} from "typeorm";

export class init1644905192237 implements MigrationInterface {
    name = 'init1644905192237'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "pdf_metadata" ("pdfLocation" character varying NOT NULL, "totalPages" integer NOT NULL, "pagesGenerated" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_d7167c7ee1304653ae4cd810fd0" PRIMARY KEY ("pdfLocation"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "pdf_metadata"`);
    }

}
