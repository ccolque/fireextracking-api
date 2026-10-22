-- CreateEnum
CREATE TYPE "CapacityUnit" AS ENUM ('KG', 'LT');

-- CreateEnum
CREATE TYPE "ExtinguisherStatus" AS ENUM ('IN_STOCK', 'SOLD', 'CUSTOMER_OWNED', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "SaleItemType" AS ENUM ('NEW_SALE', 'RECHARGE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'DEBIT_CARD', 'CREDIT_CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "ReceiptType" AS ENUM ('FACTURA_X', 'RECIBO_PAGO_X');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('ISSUED', 'VOID');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'NOTIFIED', 'CONTACTED', 'RENEWED', 'DISMISSED');

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(255),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(255),
    "order" INTEGER,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "user_name" VARCHAR(80) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "refresh_token" VARCHAR(255),
    "first_name" VARCHAR(120) NOT NULL,
    "last_name" VARCHAR(120) NOT NULL,
    "url_photo" VARCHAR(500),
    "role_id" UUID NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extinguisher_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "unit" "CapacityUnit" NOT NULL,
    "order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "extinguisher_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extinguisher_capacities" (
    "id" UUID NOT NULL,
    "type_id" UUID NOT NULL,
    "capacity" DECIMAL(6,2) NOT NULL,
    "sale_price" DECIMAL(12,2),
    "recharge_price" DECIMAL(12,2),
    "order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "extinguisher_capacities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "first_name" VARCHAR(120) NOT NULL,
    "last_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "address" VARCHAR(255),
    "email" VARCHAR(255),
    "notes" VARCHAR(500),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extinguishers" (
    "id" UUID NOT NULL,
    "customer_id" UUID,
    "capacity_id" UUID NOT NULL,
    "serial_number" VARCHAR(60),
    "manufacture_date" DATE,
    "hydraulic_test_due_date" DATE,
    "brand" VARCHAR(80),
    "status" "ExtinguisherStatus" NOT NULL DEFAULT 'SOLD',
    "notes" VARCHAR(500),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "extinguishers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "sale_number" SERIAL NOT NULL,
    "customer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "sale_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "status" "SaleStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" VARCHAR(500),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "extinguisher_id" UUID,
    "capacity_id" UUID,
    "item_type" "SaleItemType" NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "charge_date" DATE,
    "expiration_date" DATE,
    "tag_owner_name" VARCHAR(240),
    "tag_address" VARCHAR(255),
    "tag_printed_at" TIMESTAMPTZ,
    "tag_print_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paid_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" VARCHAR(120),
    "notes" VARCHAR(255),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL,
    "type" "ReceiptType" NOT NULL,
    "point_of_sale" VARCHAR(4) NOT NULL,
    "number" VARCHAR(8) NOT NULL,
    "sale_id" UUID NOT NULL,
    "payment_id" UUID,
    "customer_id" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "paid_to_date" DECIMAL(12,2),
    "balance_after" DECIMAL(12,2),
    "pdf_url" VARCHAR(500),
    "status" "ReceiptStatus" NOT NULL DEFAULT 'ISSUED',
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renewal_reminders" (
    "id" UUID NOT NULL,
    "sale_item_id" UUID NOT NULL,
    "extinguisher_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "due_date" DATE NOT NULL,
    "notify_from" DATE NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "notified_at" TIMESTAMPTZ,
    "contacted_at" TIMESTAMPTZ,
    "contacted_by" UUID,
    "renewed_sale_item_id" UUID,
    "notes" VARCHAR(500),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "renewal_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_settings" (
    "id" UUID NOT NULL,
    "business_name" VARCHAR(160) NOT NULL,
    "address" VARCHAR(255),
    "phone" VARCHAR(40),
    "email" VARCHAR(255),
    "logo_url" VARCHAR(500),
    "point_of_sale" VARCHAR(4) NOT NULL DEFAULT '0001',
    "factura_x_next_number" INTEGER NOT NULL DEFAULT 1,
    "recibo_pago_x_next_number" INTEGER NOT NULL DEFAULT 1,
    "renewal_notice_days" INTEGER NOT NULL DEFAULT 3,
    "tag_validity_months" INTEGER NOT NULL DEFAULT 12,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_user_name_key" ON "users"("user_name");

-- CreateIndex
CREATE UNIQUE INDEX "extinguisher_types_code_key" ON "extinguisher_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "extinguisher_capacities_type_id_capacity_key" ON "extinguisher_capacities"("type_id", "capacity");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_last_name_first_name_idx" ON "customers"("last_name", "first_name");

-- CreateIndex
CREATE INDEX "extinguishers_serial_number_idx" ON "extinguishers"("serial_number");

-- CreateIndex
CREATE INDEX "extinguishers_customer_id_idx" ON "extinguishers"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_sale_number_key" ON "sales"("sale_number");

-- CreateIndex
CREATE INDEX "sales_customer_id_idx" ON "sales"("customer_id");

-- CreateIndex
CREATE INDEX "sales_sale_date_idx" ON "sales"("sale_date");

-- CreateIndex
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "payments_sale_id_idx" ON "payments"("sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_payment_id_key" ON "receipts"("payment_id");

-- CreateIndex
CREATE INDEX "receipts_sale_id_idx" ON "receipts"("sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_type_point_of_sale_number_key" ON "receipts"("type", "point_of_sale", "number");

-- CreateIndex
CREATE UNIQUE INDEX "renewal_reminders_sale_item_id_key" ON "renewal_reminders"("sale_item_id");

-- CreateIndex
CREATE INDEX "renewal_reminders_status_notify_from_idx" ON "renewal_reminders"("status", "notify_from");

-- CreateIndex
CREATE INDEX "renewal_reminders_due_date_idx" ON "renewal_reminders"("due_date");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extinguisher_capacities" ADD CONSTRAINT "extinguisher_capacities_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "extinguisher_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extinguishers" ADD CONSTRAINT "extinguishers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extinguishers" ADD CONSTRAINT "extinguishers_capacity_id_fkey" FOREIGN KEY ("capacity_id") REFERENCES "extinguisher_capacities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_extinguisher_id_fkey" FOREIGN KEY ("extinguisher_id") REFERENCES "extinguishers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_capacity_id_fkey" FOREIGN KEY ("capacity_id") REFERENCES "extinguisher_capacities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_reminders" ADD CONSTRAINT "renewal_reminders_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_reminders" ADD CONSTRAINT "renewal_reminders_extinguisher_id_fkey" FOREIGN KEY ("extinguisher_id") REFERENCES "extinguishers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_reminders" ADD CONSTRAINT "renewal_reminders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_reminders" ADD CONSTRAINT "renewal_reminders_contacted_by_fkey" FOREIGN KEY ("contacted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
