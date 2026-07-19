import { useEffect, useState } from 'react'
import { AlertTriangle, GitMerge, RefreshCw, Route, Upload } from 'lucide-react'
import { useTreeStore } from '../../store/useTreeStore'
import { MOCK_TREE_DATA } from '../../data/mockTree'
import { getActiveTree } from '../../types/financialTree'
import clsx from 'clsx'

const SAMPLE_JSON = JSON.stringify(MOCK_TREE_DATA, null, 2)

export function IngestionTerminal() {
  const [rawJson, setRawJson] = useState(SAMPLE_JSON)
  const [detectedSymbol, setDetectedSymbol] = useState<string | null>(null)

  const repository = useTreeStore((s) => s.repository)
  const activeSymbol = useTreeStore((s) => s.activeSymbol)
  const pendingIncomingData = useTreeStore((s) => s.pendingIncomingData)
  const mergeError = useTreeStore((s) => s.mergeError)
  const processIncomingJson = useTreeStore((s) => s.processIncomingJson)
  const executeInitialize = useTreeStore((s) => s.executeInitialize)
  const executeIncrementalMerge = useTreeStore((s) => s.executeIncrementalMerge)
  const clearPendingIncoming = useTreeStore((s) => s.clearPendingIncoming)
  const clearMergeError = useTreeStore((s) => s.clearMergeError)

  const activeTree = getActiveTree(repository, activeSymbol)
  const lastUpdated = activeTree?.lastUpdated
  const knownSymbols = Object.keys(repository)
  const isConflict = pendingIncomingData != null

  const detectSymbolFromText = (text: string) => {
    try {
      const parsed = JSON.parse(text) as { stockSymbol?: string }
      setDetectedSymbol(parsed.stockSymbol ?? null)
    } catch {
      setDetectedSymbol(null)
    }
  }

  useEffect(() => {
    detectSymbolFromText(rawJson)
  }, [])

  const handleParseAndRoute = () => {
    clearMergeError()
    const result = processIncomingJson(rawJson)
    if (result.status === 'ERROR') return
    try {
      const parsed = JSON.parse(rawJson) as { stockSymbol?: string }
      setDetectedSymbol(parsed.stockSymbol ?? null)
    } catch {
      /* ignore */
    }
  }

  const handleMerge = () => {
    if (!pendingIncomingData) return
    executeIncrementalMerge(pendingIncomingData)
  }

  const handleOverwrite = () => {
    if (!pendingIncomingData) return
    executeInitialize(pendingIncomingData)
  }

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-r border-slate-800 bg-slate-950">
      <header className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-500">
              Ingestion Router
            </p>
            <h2 className="mt-0.5 text-sm font-semibold text-slate-100">
              Snapshot Vault
            </h2>
          </div>
          {lastUpdated && (
            <span className="font-mono text-[10px] text-slate-500">
              {lastUpdated}
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3">
        <textarea
          value={rawJson}
          onChange={(e) => {
            if (isConflict) return
            setRawJson(e.target.value)
            clearMergeError()
            detectSymbolFromText(e.target.value)
          }}
          readOnly={isConflict}
          spellCheck={false}
          className={clsx(
            'min-h-0 flex-1 resize-none rounded-lg border bg-slate-900/80 p-3 font-mono text-[11px] leading-relaxed text-emerald-200/90 outline-none',
            isConflict
              ? 'cursor-not-allowed border-slate-700 opacity-60'
              : 'border-slate-800 focus:border-emerald-700/50 focus:ring-1 focus:ring-emerald-700/30',
          )}
          placeholder="Paste TreeData JSON…"
        />

        {detectedSymbol && !isConflict && (
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Detected
            </span>
            <span className="truncate font-mono text-xs text-emerald-300">
              {detectedSymbol}
            </span>
          </div>
        )}

        {isConflict && pendingIncomingData && (
          <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-slate-950/90 p-3 shadow-[0_0_20px_rgba(16,185,129,0.12)]">
            <div className="flex items-start gap-2">
              <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <div>
                <p className="text-xs font-semibold text-emerald-200">
                  Asset Match Detected
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  <span className="font-mono text-emerald-300">
                    {pendingIncomingData.stockSymbol}
                  </span>{' '}
                  already exists in your workspace snapshot vault. How would you
                  like to proceed?
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleMerge}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
            >
              <GitMerge className="h-3.5 w-3.5" />
              Combine &amp; Add Branches (Merge)
            </button>
            <button
              type="button"
              onClick={handleOverwrite}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-700/60 bg-rose-950/40 px-3 py-2.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-900/40"
            >
              <Upload className="h-3.5 w-3.5" />
              Wipe Old &amp; Overwrite (Reset)
            </button>
            <button
              type="button"
              onClick={clearPendingIncoming}
              className="w-full py-1 text-center font-mono text-[10px] text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
        )}

        {mergeError && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-800/60 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="font-mono leading-relaxed">{mergeError}</span>
          </div>
        )}

        {!isConflict && (
          <button
            type="button"
            onClick={handleParseAndRoute}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 active:scale-[0.98]"
          >
            <Route className="h-3.5 w-3.5" />
            Parse &amp; Route JSON
          </button>
        )}

        {knownSymbols.length > 0 && (
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2">
            <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-600">
              Repository ({knownSymbols.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {knownSymbols.map((sym) => (
                <span
                  key={sym}
                  className={clsx(
                    'rounded border px-1.5 py-0.5 font-mono text-[10px]',
                    sym === activeSymbol
                      ? 'border-emerald-700/60 bg-emerald-950/50 text-emerald-300'
                      : 'border-slate-700 text-slate-400',
                  )}
                >
                  {sym}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="font-mono text-[10px] leading-relaxed text-slate-600">
          Tip: change <span className="text-slate-400">stockSymbol</span> and
          route again to add another ticker. Circular childrenIds are blocked.
          Use header <span className="text-slate-400">Export / Import Vault</span>{' '}
          to back up the full sandbox (also auto-saved to localStorage).
        </p>
      </div>
    </aside>
  )
}
