"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  BarChart3, BookHeart, CalendarDays, Home, LogOut, MessageSquareText, Mic2, Settings, Shield, Users, HeartHandshake, Activity, Network,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/api";
import { Logo, PageLoader, PersonAvatar } from "./basics";

export type Viewer = NonNullable<ReturnType<typeof useViewer>>;

export function useViewer() {
  return useQuery(api.users.viewer);
}

export function homeFor(role: string | null | undefined) {
  return role === "admin" ? "/admin" : role === "senior" ? "/senior" : role === "student" ? "/student" : "/onboarding";
}

/** Client-side routing guard. Authorization itself is enforced in every Convex function. */
export function RoleGate({ role, children }: { role: "student" | "senior" | "admin" | "any"; children: (viewer: Viewer) => React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const viewer = useViewer();
  const router = useRouter();
  React.useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace("/signin");
    else if (viewer === null) router.replace("/signin");
    else if (viewer) {
      if (viewer.role !== "admin" && !viewer.profile) router.replace("/onboarding");
      else if (role !== "any" && viewer.role !== role) router.replace(homeFor(viewer.role));
    }
  }, [isLoading, isAuthenticated, viewer, role, router]);
  if (!viewer || (viewer.role !== "admin" && !viewer.profile) || (role !== "any" && viewer.role !== role)) return <PageLoader />;
  return <>{children(viewer)}</>;
}

/** Keeps the viewer's private Moss index in step with Convex whenever new documents are pending. */
export function MossAutoSync() {
  const status = useQuery(api.mossSync.status);
  const api2 = useApi();
  const busy = React.useRef(false);
  React.useEffect(() => {
    if (!status?.pending || busy.current) return;
    busy.current = true;
    api2("/api/moss/sync", { json: {} })
      .catch(() => {})
      .finally(() => (busy.current = false));
  }, [status?.pending, api2]);
  return null;
}

function SignOut({ className, label = "Sign out" }: { className?: string; label?: string }) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await signOut();
        router.replace("/");
      }}
      className={cn("flex items-center gap-2 text-sm font-semibold text-ink-600 hover:text-ink-900", className)}
    >
      <LogOut className="size-4" /> {label}
    </button>
  );
}

const studentNav = [
  { href: "/student", label: "Home", icon: Home },
  { href: "/student/practice", label: "Practice Studio", icon: Mic2 },
  { href: "/student/match", label: "Find a buddy", icon: HeartHandshake },
  { href: "/student/schedule", label: "Calls", icon: CalendarDays },
  { href: "/student/feedback", label: "Feedback", icon: MessageSquareText },
  { href: "/student/progress", label: "Progress", icon: BarChart3 },
  { href: "/student/settings", label: "Privacy", icon: Settings },
];

export function StudentShell({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  const path = usePathname();
  const p = viewer.profile!;
  return (
    <div className="min-h-screen bg-cream-100">
      <MossAutoSync />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-900/[0.07] bg-white px-4 py-6 lg:flex">
        <Link href="/student" className="px-2"><Logo /></Link>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {studentNav.map((n) => {
            const active = n.href === "/student" ? path === n.href : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                  active ? "bg-sage-50 text-sage-800" : "text-ink-600 hover:bg-cream-100 hover:text-ink-900",
                )}
              >
                <n.icon className={cn("size-[18px]", active ? "text-sage-600" : "")} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 rounded-2xl bg-cream-100 p-3">
          <PersonAvatar avatar={p.avatar} color={p.avatarColor} name={p.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{p.name}</p>
            <p className="truncate text-xs capitalize text-ink-500">{p.proficiency} learner</p>
          </div>
        </div>
        <SignOut className="mt-3 px-3" />
      </aside>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-900/[0.07] bg-cream-100/95 px-4 py-3 lg:hidden">
        <Logo size="sm" />
        <SignOut label="" />
      </header>
      <main className="px-4 pb-28 pt-6 sm:px-8 lg:ml-64 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-6xl animate-rise">{children}</div>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-ink-900/[0.07] bg-white px-2 py-2 lg:hidden">
        {studentNav.slice(0, 5).map((n) => {
          const active = n.href === "/student" ? path === n.href : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={cn("flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-semibold", active ? "text-sage-700" : "text-ink-500")}>
              <n.icon className="size-5" />
              {n.label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

const seniorNav = [
  { href: "/senior", label: "Home", icon: Home },
  { href: "/senior/friends", label: "My Friends", icon: Users },
  { href: "/senior/memories", label: "Memory Book", icon: BookHeart },
  { href: "/senior/schedule", label: "My Calls", icon: CalendarDays },
  { href: "/senior/settings", label: "Settings", icon: Settings },
];

export function SeniorShell({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  const path = usePathname();
  const p = viewer.profile!;
  const a = p.accessibility;
  return (
    <div className={cn("senior min-h-screen bg-cream-100", a?.highContrast && "contrast", a?.largeText && "text-[1.25rem]")}>
      <MossAutoSync />
      <header className="no-print sticky top-0 z-20 border-b border-ink-900/[0.07] bg-white/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/senior"><Logo /></Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {seniorNav.map((n) => {
              const active = n.href === "/senior" ? path === n.href : path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-base font-bold transition",
                    active ? "bg-sage-600 text-white" : "text-ink-700 hover:bg-white",
                  )}
                >
                  <n.icon className="size-5" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <PersonAvatar avatar={p.avatar} color={p.avatarColor} name={p.name} size="sm" />
            <SignOut className="whitespace-nowrap text-base" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-32 pt-8 lg:pb-16">
        <div className="animate-rise">{children}</div>
      </main>
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-ink-900/10 bg-cream-50 lg:hidden" aria-label="Main">
        {seniorNav.map((n) => {
          const active = n.href === "/senior" ? path === n.href : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={cn("flex flex-col items-center gap-1 py-3 text-xs font-bold", active ? "bg-sage-100 text-sage-800" : "text-ink-700")}>
              <n.icon className="size-6" />
              {n.label.replace("My ", "")}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

const adminNav = [
  { href: "/admin", label: "Overview", icon: Activity },
  { href: "/admin/matching", label: "Matching workspace", icon: Network },
  { href: "/admin/integrations", label: "Sponsor integrations", icon: Shield },
];

export function AdminShell({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-screen bg-cream-100">
      <header className="sticky top-0 z-20 border-b border-ink-900/10 bg-ink-900 text-cream-100">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo size="sm" className="text-cream-50" />
            <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-cream-200">Operations</span>
          </Link>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {adminNav.map((n) => {
              const active = n.href === "/admin" ? path === n.href : path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={cn("flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold", active ? "bg-white/15 text-white" : "text-cream-200/80 hover:text-white")}>
                  <n.icon className="size-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <span className="hidden text-sm text-cream-200/80 sm:inline">{viewer.name}</span>
          <SignOut className="text-cream-200 hover:text-white" label="" />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
