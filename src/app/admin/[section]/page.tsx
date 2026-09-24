import { notFound } from "next/navigation";
import type { AdminView } from "@/components/admin/admin-workspace-nav";

const adminSections: AdminView[] = [
  "dashboard",
  "recommendations",
  "questions",
  "topics",
  "handbook",
  "featured",
  "announcement",
];

export default async function AdminSectionPage({ params }: PageProps<"/admin/[section]">) {
  const { section } = await params;
  if (!adminSections.includes(section as AdminView)) notFound();
  return null;
}
