/*
  Warnings:

  - You are about to drop the column `restaurantId` on the `CartItem` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_restaurantId_fkey";

-- AlterTable
ALTER TABLE "CartItem" DROP COLUMN "restaurantId";
