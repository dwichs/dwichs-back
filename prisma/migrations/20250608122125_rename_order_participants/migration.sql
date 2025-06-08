/*
  Warnings:

  - You are about to drop the `OrderGroupMember` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "OrderGroupMember" DROP CONSTRAINT "OrderGroupMember_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderGroupMember" DROP CONSTRAINT "OrderGroupMember_userId_fkey";

-- DropTable
DROP TABLE "OrderGroupMember";

-- CreateTable
CREATE TABLE "OrderParticipants" (
    "orderId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "OrderParticipants_pkey" PRIMARY KEY ("orderId","userId")
);

-- AddForeignKey
ALTER TABLE "OrderParticipants" ADD CONSTRAINT "OrderParticipants_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderParticipants" ADD CONSTRAINT "OrderParticipants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
