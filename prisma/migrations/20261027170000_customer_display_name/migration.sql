-- Nombre para mostrar/buscar/ordenar (lo mantiene la API)
ALTER TABLE "customers" ADD COLUMN "display_name" VARCHAR(255);

UPDATE "customers" SET "display_name" = CASE
  WHEN "customer_type" = 'COMPANY' THEN COALESCE("business_name", '')
  ELSE TRIM(CONCAT_WS(' ', "first_name", "last_name"))
END;

ALTER TABLE "customers" ALTER COLUMN "display_name" SET NOT NULL;

CREATE INDEX "customers_display_name_idx" ON "customers"("display_name");
