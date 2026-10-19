"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { ChevronRightIcon } from "@/app/components/Icons";
import { Spinner, cardClass } from "./ui";
import OverviewTab from "./OverviewTab";
import FeedbackTab from "./FeedbackTab";
import UsersTab from "./UsersTab";
import AnnouncementsTab from "./AnnouncementsTab";

const TABS = [
  { id: "overview",      label: "Overview" },
  { id: "feedback",      label: "Feedback" },
  { id: "users",         label: "Users" },
  { id: "announcements", label: "Announcements" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function AdminPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <AdminDashboard />
    </Suspense>
  );
}

// Access is enforced by supabase/admin.sql; this check only decides what to show.
function AdminDashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<"checking" | "granted" | "denied">("checking");
  const userId = user?.id;

  useEffect(() => {
    if (!authLoading && !userId) router.replace("/");
  }, [userId, authLoading, router]);

  useEffect(() => {
    if (!userId) return;
    supabase.rpc("is_admin").then(({ data, error }) => setAccess(!error && data === true ? "granted" : "denied"));
  }, [userId]);

  const tabParam = params.get("tab");
  const tab: Tab = TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : "overview";
  const setTab = (t: Tab) => router.replace(`/admin?tab=${t}`);

  if (authLoading || !user || access === "checking") return <Spinner />;

  if (access === "denied") return (
    <div className={`${cardClass} max-w-md mx-auto p-6 text-center space-y-2`}>
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">No access</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">This page is only for admins.</p>
      <Link href="/" className="inline-block text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">← Home</Link>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Home</Link>
        <ChevronRightIcon className="w-4 h-4" />
        <span className="text-gray-900 dark:text-gray-100 font-medium">Admin</span>
      </nav>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin</h1>

      <div className="flex gap-1 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`shrink-0 px-4 py-2 min-h-[44px] rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              tab === t.id ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "overview" && <OverviewTab onOpenFeedback={() => setTab("feedback")} />}
        {tab === "feedback" && <FeedbackTab />}
        {tab === "users" && <UsersTab />}
        {tab === "announcements" && <AnnouncementsTab />}
      </div>
    </div>
  );
}
