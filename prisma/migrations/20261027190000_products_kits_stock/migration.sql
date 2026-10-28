-- AlterEnum
ALTER TYPE "SaleItemType" ADD VALUE 'PRODUCT';
ALTER TYPE "SaleItemType" ADD VALUE 'KIT';

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('PRODUCT', 'KIT');
CREATE TYPE "StockMovementReason" AS ENUM ('INITIAL', 'ADJUSTMENT', 'SALE', 'SALE_CANCELLED');

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "kind" "ProductKind" NOT NULL DEFAULT 'PRODUCT',
    "name" VARCHAR(120) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "stock" INTEGER,
    "brand_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "products_price_chk" CHECK ("price" >= 0),
    CONSTRAINT "products_stock_chk" CHECK (
      ("kind" = 'PRODUCT' AND "stock" IS NOT NULL AND "stock" >= 0)
      OR ("kind" = 'KIT' AND "stock" IS NULL)
    )
);

CREATE TABLE "product_kit_items" (
    "id" UUID NOT NULL,
    "kit_id" UUID NOT NULL,
    "product_id" UUID,
    "capacity_id" UUID,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_kit_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_kit_items_quantity_chk" CHECK ("quantity" >= 1),
    CONSTRAINT "product_kit_items_one_component_chk" CHECK (("product_id" IS NULL) <> ("capacity_id" IS NULL))
);

CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "stock_after" INTEGER NOT NULL,
    "reason" "StockMovementReason" NOT NULL,
    "sale_item_id" UUID,
    "notes" VARCHAR(255),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN "product_id" UUID, ADD COLUMN "parent_item_id" UUID;

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");
CREATE INDEX "product_kit_items_kit_id_idx" ON "product_kit_items"("kit_id");
CREATE INDEX "stock_movements_product_id_created_at_idx" ON "stock_movements"("product_id", "created_at");
CREATE INDEX "sale_items_parent_item_id_idx" ON "sale_items"("parent_item_id");
CREATE INDEX "sale_items_product_id_idx" ON "sale_items"("product_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_kit_items" ADD CONSTRAINT "product_kit_items_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_kit_items" ADD CONSTRAINT "product_kit_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_kit_items" ADD CONSTRAINT "product_kit_items_capacity_id_fkey" FOREIGN KEY ("capacity_id") REFERENCES "extinguisher_capacities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_parent_item_id_fkey" FOREIGN KEY ("parent_item_id") REFERENCES "sale_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
