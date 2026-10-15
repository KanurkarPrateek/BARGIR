/*
  Warnings:

  - The `primaryMuscle` column on the `Exercise` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `secondaryMuscle` column on the `Exercise` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Exercise" DROP COLUMN "primaryMuscle",
ADD COLUMN     "primaryMuscle" TEXT[],
DROP COLUMN "secondaryMuscle",
ADD COLUMN     "secondaryMuscle" TEXT[];
