-- CreateTable
CREATE TABLE "FoodItems" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calories" INTEGER NOT NULL,
    "recipe" TEXT,
    "protein" INTEGER,
    "carbs" INTEGER,
    "fats" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodItems_pkey" PRIMARY KEY ("id")
);
