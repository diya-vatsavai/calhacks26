"use client";
import { RoleGate, StudentShell } from "@/components/kindred/shells";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate role="student">{(viewer) => <StudentShell viewer={viewer}>{children}</StudentShell>}</RoleGate>;
}
