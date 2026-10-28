-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('PERSON', 'COMPANY');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "business_name" VARCHAR(200),
ADD COLUMN     "cuit" VARCHAR(11),
ADD COLUMN     "customer_type" "CustomerType" NOT NULL DEFAULT 'PERSON',
ALTER COLUMN "first_name" DROP NOT NULL,
ALTER COLUMN "last_name" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "customers_business_name_idx" ON "customers"("business_name");

-- CreateIndex
CREATE INDEX "customers_cuit_idx" ON "customers"("cuit");

-- Reglas por tipo de cliente (la API tambien las valida)
ALTER TABLE "customers" ADD CONSTRAINT "customers_type_required_fields_chk" CHECK (
  ("customer_type" = 'PERSON' AND "first_name" IS NOT NULL AND "last_name" IS NOT NULL)
  OR ("customer_type" = 'COMPANY' AND "business_name" IS NOT NULL AND "cuit" IS NOT NULL)
);
