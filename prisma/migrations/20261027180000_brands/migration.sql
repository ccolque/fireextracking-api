-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "brands_name_idx" ON "brands"("name");

-- AlterTable
ALTER TABLE "extinguishers" ADD COLUMN "brand_id" UUID;

-- Migra las marcas cargadas como texto libre
INSERT INTO "brands" ("id", "name", "updated_at")
SELECT gen_random_uuid(), b.name, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT TRIM("brand") AS name FROM "extinguishers" WHERE TRIM(COALESCE("brand", '')) <> '') b;

UPDATE "extinguishers" e SET "brand_id" = br."id"
FROM "brands" br WHERE TRIM(e."brand") = br."name";

ALTER TABLE "extinguishers" DROP COLUMN "brand";

-- CreateIndex
CREATE INDEX "extinguishers_brand_id_idx" ON "extinguishers"("brand_id");

-- AddForeignKey
ALTER TABLE "extinguishers" ADD CONSTRAINT "extinguishers_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
