/*
  Warnings:

  - A unique constraint covering the columns `[identifier,type]` on the table `otps` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "otps_identifier_type_key" ON "otps"("identifier", "type");
