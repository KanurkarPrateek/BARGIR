-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "json_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "force" TEXT,
    "level" TEXT,
    "mechanic" TEXT,
    "equipment" TEXT,
    "primaryMuscle" TEXT,
    "secondaryMuscle" TEXT,
    "instructions" TEXT[],
    "category" TEXT,
    "images" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);
