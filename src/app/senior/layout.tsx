"use client";
import { RoleGate, SeniorShell } from "@/components/kindred/shells";

export default function SeniorLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate role="senior">{(viewer) => <SeniorShell viewer={viewer}>{children}</SeniorShell>}</RoleGate>;
}
