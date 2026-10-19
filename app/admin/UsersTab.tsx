"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { ErrorText, Spinner, cardClass, dangerButton, inputClass, secondaryButton, timeAgo } from "./ui";

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned: boolean;
  is_admin: boolean;
  tracked_sets: number;
  owned_cards: number;
}

const PAGE_SIZE = 50;

export default function UsersTab() {
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [query, setQuery]   = useState("");
  const [users, setUsers]   = useState<AdminUser[] | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_list_users", { search: query, lim: PAGE_SIZE, off: 0 });
    if (error) setError(error.message);
    else { setError(null); setUsers(data as AdminUser[]); }
  }, [query]);

  useEffect(() => {
    // Async fetch: state is set after it resolves, not synchronously here.
    void load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  function onSearch(value: string) {
    setSearch(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setQuery(value.trim()), 300);
  }

  return (
    <div className="space-y-4">
      <input type="search" value={search} onChange={(e) => onSearch(e.target.value)}
        placeholder="Search by email" aria-label="Search users by email" className={inputClass} />
      {error && <ErrorText>Couldn’t load users: {error}</ErrorText>}
      {!users && !error && <Spinner />}
      {users?.length === 0 && <p className="py-12 text-center text-gray-400">No users found</p>}
      {users?.map((u) => <UserRow key={u.id} user={u} isMe={u.id === me?.id} onChanged={load} />)}
      {users?.length === PAGE_SIZE && <p className="text-xs text-gray-400">Showing the newest {PAGE_SIZE}. Search to find others.</p>}
    </div>
  );
}

function UserRow({ user, isMe, onChanged }: { user: AdminUser; isMe: boolean; onChanged: () => void }) {
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function call(fn: string, args: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) setError(error.message);
    else onChanged();
  }

  return (
    <div className={`${cardClass} p-4 space-y-2`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-gray-900 dark:text-gray-100 break-all">{user.email}</p>
        {isMe && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">You</span>}
        {user.is_admin && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">Admin</span>}
        {user.banned && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">Banned</span>}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Joined {timeAgo(user.created_at)} · last sign-in {timeAgo(user.last_sign_in_at)} · {user.tracked_sets} sets · {user.owned_cards} cards
      </p>

      {error && <ErrorText>{error}</ErrorText>}

      {!isMe && (
        deleting ? (
          <div className="space-y-2">
            <label className="block text-sm text-gray-700 dark:text-gray-300">
              Type <span className="font-mono font-semibold break-all">{user.email}</span> to permanently delete this account and its data.
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className={`${inputClass} mt-1`} aria-label="Type the email to confirm" />
            </label>
            <div className="flex gap-2">
              <button onClick={() => { setDeleting(false); setConfirmText(""); }} className={secondaryButton}>Cancel</button>
              <button disabled={busy || confirmText !== user.email} onClick={() => call("admin_delete_user", { target: user.id })} className={dangerButton}>
                Delete forever
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => call("admin_set_banned", { target: user.id, banned: !user.banned })} className={secondaryButton}>
              {user.banned ? "Unban" : "Ban"}
            </button>
            <button disabled={busy} onClick={() => call("admin_set_admin", { target: user.id, make_admin: !user.is_admin })} className={secondaryButton}>
              {user.is_admin ? "Remove admin" : "Make admin"}
            </button>
            <button onClick={() => setDeleting(true)} className={dangerButton}>Delete</button>
          </div>
        )
      )}
    </div>
  );
}
