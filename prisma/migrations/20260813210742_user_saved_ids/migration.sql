-- AlterTable
ALTER TABLE "User" ADD COLUMN     "savedProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
