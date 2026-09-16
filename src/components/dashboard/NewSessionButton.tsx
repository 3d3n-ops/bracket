"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewSessionButton({
  problemId,
  label = "Freestyle session",
  className,
}: {
  problemId?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ problemId: problemId ?? null }),
      });
      const { id } = (await res.json()) as { id: string };
      router.push(`/session/${id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={create}
      disabled={busy}
      className={
        className ??
        "rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
      }
    >
      {busy ? "Opening…" : label}
    </button>
  );
}
