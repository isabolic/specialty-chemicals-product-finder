-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('ACTIVE', 'PHASE_OUT', 'DISCONTINUED');

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chemical_name" TEXT NOT NULL,
    "function" TEXT NOT NULL,
    "application_area" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "product_status" NOT NULL,
    "launch_year" INTEGER,
    "description" TEXT NOT NULL,
    "delisted_at" TIMESTAMP(3),
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "rating_average" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "product_id" INTEGER NOT NULL,
    "rating" SMALLINT NOT NULL,
    "author_name" VARCHAR(80) NOT NULL,
    "title" VARCHAR(120),
    "body" VARCHAR(4000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_runs" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "rows_read" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "unchanged" INTEGER NOT NULL DEFAULT 0,
    "delisted" INTEGER NOT NULL DEFAULT 0,
    "rejected" INTEGER NOT NULL DEFAULT 0,
    "issues" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "products_function_idx" ON "products"("function");

-- CreateIndex
CREATE INDEX "products_application_area_idx" ON "products"("application_area");

-- CreateIndex
CREATE INDEX "products_region_idx" ON "products"("region");

-- CreateIndex
CREATE INDEX "products_certifications_idx" ON "products" USING GIN ("certifications");

-- CreateIndex
CREATE INDEX "reviews_product_id_created_at_idx" ON "reviews"("product_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Invariants Prisma's schema language cannot express.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "products" ADD CONSTRAINT "products_review_count_non_negative" CHECK ("review_count" >= 0);
