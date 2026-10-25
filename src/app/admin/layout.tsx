"use client";
import { AdminShell, RoleGate } from "@/components/kindred/shells";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate role="admin">{(viewer) => <AdminShell viewer={viewer}>{children}</AdminShell>}</RoleGate>;
}
