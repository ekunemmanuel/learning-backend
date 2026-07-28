import { prisma as db } from "@/lib/prisma";
import { CreateExamples, UpdateExamples } from "./schema";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { AppError } from "@/lib/errors";

export const getExamples = async () => {
  return await db.example.findMany();
};

export const createExample = async (data: CreateExamples) => {
  return await db.example.create({ data });
};

export const getExampleById = async (id: number) => {
  return await db.example.findUnique({
    where: { id },
  });
};

export const updateExample = async (id: number, data: UpdateExamples) => {
  const example = await getExampleById(id);
  if (!example) throw new AppError(HttpStatusCodes.NOT_FOUND, "Example not found");
  return await db.example.update({
    where: { id },
    data,
  });
};

export const deleteExample = async (id: number) => {
  const example = await getExampleById(id);
  if (!example) throw new AppError(HttpStatusCodes.NOT_FOUND, "Example not found");
  return await db.example.delete({
    where: { id },
  });
};
