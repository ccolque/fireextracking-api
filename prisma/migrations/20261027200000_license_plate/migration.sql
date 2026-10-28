-- Patente (matafuegos de 1 kg): ultima conocida en el envase y snapshot en la ficha
ALTER TABLE "extinguishers" ADD COLUMN "license_plate" VARCHAR(10);
ALTER TABLE "sale_items" ADD COLUMN "tag_license_plate" VARCHAR(10);
