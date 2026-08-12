"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const nameSchema = z.string().trim().min(1).max(120);

function revalidateHierarchy() {
  revalidatePath("/super-admin/hierarchy");
  revalidatePath("/super-admin/questions");
  revalidatePath("/super-admin/questions/list");
}

async function assertSuperAdmin() {
  await requireRole(["SUPER_ADMIN"]);
}

export async function createBoard(formData: FormData) {
  await assertSuperAdmin();
  const name = nameSchema.parse(formData.get("name"));
  const board = await prisma.board.create({ data: { name } });
  revalidateHierarchy();
  return { id: board.id, name: board.name };
}

export async function updateBoard(formData: FormData) {
  await assertSuperAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  const name = nameSchema.parse(formData.get("name"));
  await prisma.board.update({ where: { id }, data: { name } });
  revalidateHierarchy();
  return { id, name };
}

export async function deleteBoard(formData: FormData) {
  await assertSuperAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  await prisma.board.delete({ where: { id } });
  revalidateHierarchy();
  return { id };
}

export async function createClass(formData: FormData) {
  await assertSuperAdmin();
  const boardId = z.string().min(1).parse(formData.get("boardId"));
  const name = nameSchema.parse(formData.get("name"));
  const klass = await prisma.class.create({ data: { boardId, name } });
  revalidateHierarchy();
  return { id: klass.id, name: klass.name, boardId };
}

export async function updateClass(formData: FormData) {
  await assertSuperAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  const name = nameSchema.parse(formData.get("name"));
  await prisma.class.update({ where: { id }, data: { name } });
  revalidateHierarchy();
  return { id, name };
}

export async function deleteClass(formData: FormData) {
  await assertSuperAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  await prisma.class.delete({ where: { id } });
  revalidateHierarchy();
  return { id };
}

export async function createSubject(formData: FormData) {
  await assertSuperAdmin();
  const classId = z.string().min(1).parse(formData.get("classId"));
  const name = nameSchema.parse(formData.get("name"));
  const subject = await prisma.subject.create({ data: { classId, name } });
  revalidateHierarchy();
  return { id: subject.id, name: subject.name, classId };
}

export async function updateSubject(formData: FormData) {
  await assertSuperAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  const name = nameSchema.parse(formData.get("name"));
  await prisma.subject.update({ where: { id }, data: { name } });
  revalidateHierarchy();
  return { id, name };
}

export async function deleteSubject(formData: FormData) {
  await assertSuperAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  await prisma.subject.delete({ where: { id } });
  revalidateHierarchy();
  return { id };
}

export async function createChapter(formData: FormData) {
  await assertSuperAdmin();
  const subjectId = z.string().min(1).parse(formData.get("subjectId"));
  const name = nameSchema.parse(formData.get("name"));
  const order = Number(formData.get("order") ?? 0) || 0;
  const chapter = await prisma.chapter.create({ data: { subjectId, name, order } });
  revalidateHierarchy();
  return { id: chapter.id, name: chapter.name, order: chapter.order, subjectId };
}

export async function updateChapter(formData: FormData) {
  await assertSuperAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  const name = nameSchema.parse(formData.get("name"));
  const order = Number(formData.get("order") ?? 0) || 0;
  await prisma.chapter.update({ where: { id }, data: { name, order } });
  revalidateHierarchy();
  return { id, name, order };
}

export async function deleteChapter(formData: FormData) {
  await assertSuperAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  await prisma.chapter.delete({ where: { id } });
  revalidateHierarchy();
  return { id };
}

export async function createTopic(formData: FormData) {
  await assertSuperAdmin();
  const chapterId = z.string().min(1).parse(formData.get("chapterId"));
  const name = nameSchema.parse(formData.get("name"));
  const order = Number(formData.get("order") ?? 0) || 0;
  const topic = await prisma.topic.create({ data: { chapterId, name, order } });
  revalidateHierarchy();
  return { id: topic.id, name: topic.name, order: topic.order, chapterId };
}

export async function updateTopic(formData: FormData) {
  await assertSuperAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  const name = nameSchema.parse(formData.get("name"));
  const order = Number(formData.get("order") ?? 0) || 0;
  await prisma.topic.update({ where: { id }, data: { name, order } });
  revalidateHierarchy();
  return { id, name, order };
}

export async function deleteTopic(formData: FormData) {
  await assertSuperAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  await prisma.topic.delete({ where: { id } });
  revalidateHierarchy();
  return { id };
}
