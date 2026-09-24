import type { ReactNode } from "react";
import AdminConsole from "@/components/admin/admin-console";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminConsole />
      {children}
    </>
  );
}
