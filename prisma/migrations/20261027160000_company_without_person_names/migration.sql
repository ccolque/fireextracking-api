-- Las empresas no tienen nombre ni apellido (solo razon social)
UPDATE "customers" SET "first_name" = NULL, "last_name" = NULL WHERE "customer_type" = 'COMPANY';

ALTER TABLE "customers" DROP CONSTRAINT "customers_type_required_fields_chk";
ALTER TABLE "customers" ADD CONSTRAINT "customers_type_required_fields_chk" CHECK (
  ("customer_type" = 'PERSON' AND "first_name" IS NOT NULL AND "last_name" IS NOT NULL)
  OR ("customer_type" = 'COMPANY' AND "business_name" IS NOT NULL AND "cuit" IS NOT NULL
      AND "first_name" IS NULL AND "last_name" IS NULL)
);
