/*
  Warnings:

  - You are about to drop the column `quantity` on the `CartItem` table. All the data in the column will be lost.
  - Made the column `userId` on table `CartItem` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_userId_fkey";

-- AlterTable
ALTER TABLE "CartItem" DROP COLUMN "quantity",
ALTER COLUMN "userId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
