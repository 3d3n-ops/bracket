"use client";

import { useWorkspace } from "@/lib/store/workspace-store";

export function OutputPanel({ status }: { status: string | null }) {
  const run = useWorkspace((s) => s.lastRun);
  const running = useWorkspace((s) => s.running);
  const passed = run?.tests.filter((t) => t.passed).length ?? 0;
  const total = run?.tests.length ?? 0;

  return (
    <div className="h-[38%] min-h-[160px] overflow-y-auto border-t border-white/10 bg-black/40 px-3 py-2 font-mono text-xs">
      {running && <p className="animate-pulse text-zinc-400">{status ?? "Running…"}</p>}
      {!running && !run && <p className="text-zinc-500">Output and test results will appear here. ⌘↵ to run.</p>}
      {!running && run && (
        <>
          {run.error && <pre className="whitespace-pre-wrap text-red-300">{run.error}</pre>}
          {total > 0 && (
            <p className={`mb-2 font-semibold ${passed === total ? "text-emerald-300" : "text-amber-300"}`}>
              {passed}/{total} tests passed · {run.durationMs} ms
            </p>
          )}
          {run.tests.map((t, i) => (
            <div key={i} className="mb-1.5 rounded border border-white/5 bg-white/[0.03] px-2 py-1">
              <div className={t.passed ? "text-emerald-300" : "text-red-300"}>
                {t.passed ? "✓" : "✗"} {t.name}
              </div>
              {!t.passed && (
                <div className="mt-0.5 text-zinc-400">
                  {t.error ? (
                    <pre className="whitespace-pre-wrap text-red-200/80">{t.error}</pre>
                  ) : (
                    <>
                      <div>expected: <span className="text-zinc-200">{JSON.stringify(t.expected)}</span></div>
                      <div>actual:&nbsp;&nbsp; <span className="text-zinc-200">{JSON.stringify(t.actual)}</span></div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {run.stdout && (
            <div className="mt-2">
              <div className="text-zinc-500">stdout</div>
              <pre className="whitespace-pre-wrap text-zinc-200">{run.stdout}</pre>
            </div>
          )}
          {run.stderr && (
            <div className="mt-2">
              <div className="text-zinc-500">stderr</div>
              <pre className="whitespace-pre-wrap text-amber-200">{run.stderr}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
