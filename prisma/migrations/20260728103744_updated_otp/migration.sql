/*
  Warnings:

  - You are about to drop the `examples` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "OtpType" AS ENUM ('email_verification', 'password_reset', 'phone_verification');

-- AlterTable
ALTER TABLE "otps" ADD COLUMN     "type" "OtpType" NOT NULL DEFAULT 'email_verification';

-- DropTable
DROP TABLE "examples";
