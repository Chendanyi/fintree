import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  GitMerge,
  RefreshCw,
  Route,
  Upload,
} from 'lucide-react'
import { useTreeStore } from '../../store/useTreeStore'
import { MOCK_TREE_DATA } from '../../data/mockTree'
import type { TreeData, TreePatch } from '../../types/financialTree'
import { getActiveTree } from '../../types/financialTree'
import clsx from 'clsx'

const SAMPLE_JSON = JSON.stringify(MOCK_TREE_DATA, null, 2)

type ParsedOk = { ok: true; data: TreePatch & { stockSymbol?: string } }
type ParsedErr = { ok: false; error: string }

export function IngestionTerminal() {
  const [rawJson, setRawJson] = useState(SAMPLE_JSON)
  const [localError, setLocalError] = useState<string | null>(null)
  const [pendingExisting, setPendingExisting] = useState<TreeData | null>(null)
  const [detectedSymbol, setDetectedSymbol] = useState<string | null>(null)

  const stocks = useTreeStore((s) => s.stocks)
  const activeSymbol = useTreeStore((s) => s.activeSymbol)
  const initializeNewStock = useTreeStore((s) => s.initializeNewStock)
  const mergeStockPatch = useTreeStore((s) => s.mergeStockPatch)
  const overwriteStock = useTreeStore((s) => s.overwriteStock)
  const mergeError = useTreeStore((s) => s.mergeError)
  const clearMergeError = useTreeStore((s) => s.clearMergeError)

  const activeTree = getActiveTree(stocks, activeSymbol)
  const lastUpdated = activeTree?.lastUpdated

  const parsePayload = (): ParsedOk | ParsedErr => {
    try {
      const parsed = JSON.parse(rawJson) as TreePatch & {
        stockSymbol?: string
        nodes?: unknown
      }
      if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
        return { ok: false, error: 'JSON must include a "nodes" array.' }
      }
      return { ok: true, data: parsed as TreePatch }
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Invalid JSON syntax',
      }
    }
  }

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

  const requireFullTree = (
    data: TreePatch,
  ): { ok: true; tree: TreeData } | { ok: false; error: string } => {
    if (
      !data.stockSymbol ||
      data.basePrice == null ||
      !data.timelineLanes ||
      !data.nodes
    ) {
      return {
        ok: false,
        error:
          'Full model requires stockSymbol, basePrice, timelineLanes, and nodes.',
      }
    }
    return { ok: true, tree: data as TreeData }
  }

  /** Intelligent router: new symbol → init; existing → choice panel */
  const handleRouteJson = () => {
    clearMergeError()
    setPendingExisting(null)
    const result = parsePayload()
    if (!result.ok) {
      setLocalError(result.error)
      return
    }

    const full = requireFullTree(result.data)
    if (!full.ok) {
      setLocalError(full.error)
      return
    }

    const symbol = full.tree.stockSymbol
    setLocalError(null)
    setDetectedSymbol(symbol)

    if (stocks[symbol]) {
      setPendingExisting(full.tree)
      return
    }

    initializeNewStock(full.tree)
    setPendingExisting(null)
  }

  const handleSmartMerge = () => {
    if (!pendingExisting) return
    clearMergeError()
    mergeStockPatch(pendingExisting.stockSymbol, pendingExisting)
    setPendingExisting(null)
  }

  const handleOverwrite = () => {
    if (!pendingExisting) return
    clearMergeError()
    overwriteStock(pendingExisting)
    setPendingExisting(null)
  }

  /** Quick merge against active symbol when patch may omit stockSymbol */
  const handleMergeActive = () => {
    clearMergeError()
    setPendingExisting(null)
    const result = parsePayload()
    if (!result.ok) {
      setLocalError(result.error)
      return
    }
    const symbol = result.data.stockSymbol ?? activeSymbol
    if (!symbol) {
      setLocalError('No active symbol. Route a full JSON profile first.')
      return
    }
    if (!stocks[symbol]) {
      setLocalError(
        `Symbol ${symbol} is not in the repository. Use Route JSON to initialize.`,
      )
      return
    }
    setLocalError(null)
    mergeStockPatch(symbol, result.data)
  }

  const error = localError ?? mergeError
  const knownSymbols = useMemo(() => Object.keys(stocks), [stocks])

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-r border-slate-800 bg-slate-950">
      <header className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-500">
              Ingestion Router
            </p>
            <h2 className="mt-0.5 text-sm font-semibold text-slate-100">
              Multi-Asset Stream
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
            setRawJson(e.target.value)
            setLocalError(null)
            setPendingExisting(null)
            detectSymbolFromText(e.target.value)
          }}
          spellCheck={false}
          className="min-h-0 flex-1 resize-none rounded-lg border border-slate-800 bg-slate-900/80 p-3 font-mono text-[11px] leading-relaxed text-emerald-200/90 outline-none focus:border-emerald-700/50 focus:ring-1 focus:ring-emerald-700/30"
          placeholder="Paste TreeData JSON…"
        />

        {detectedSymbol && (
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Detected
            </span>
            <span className="truncate font-mono text-xs text-emerald-300">
              {detectedSymbol}
            </span>
          </div>
        )}

        {pendingExisting && (
          <div className="space-y-2 rounded-xl border border-amber-700/50 bg-amber-950/30 p-3">
            <div className="flex items-start gap-2">
              <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <div>
                <p className="text-xs font-semibold text-amber-200">
                  Asset already in repository
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-200/70">
                  <span className="font-mono text-amber-100">
                    {pendingExisting.stockSymbol}
                  </span>{' '}
                  exists. Choose how to apply this JSON snapshot.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSmartMerge}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
            >
              <GitMerge className="h-3.5 w-3.5" />
              Smart Incremental Merge
            </button>
            <button
              type="button"
              onClick={handleOverwrite}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-700/60 bg-rose-950/40 px-3 py-2.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-900/40"
            >
              <Upload className="h-3.5 w-3.5" />
              Complete Overwrite / Reset
            </button>
            <button
              type="button"
              onClick={() => setPendingExisting(null)}
              className="w-full py-1 text-center font-mono text-[10px] text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-800/60 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="font-mono leading-relaxed">{error}</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleRouteJson}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 active:scale-[0.98]"
          >
            <Route className="h-3.5 w-3.5" />
            Route JSON (Auto Detect)
          </button>
          <button
            type="button"
            onClick={handleMergeActive}
            disabled={!activeSymbol}
            className={clsx(
              'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition active:scale-[0.98]',
              activeSymbol
                ? 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600 hover:bg-slate-800'
                : 'cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-600',
            )}
          >
            <GitMerge className="h-3.5 w-3.5" />
            Merge Into Active
          </button>
        </div>

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
          Tip: double-click a node to lock it as fact. Sibling paths soft-extinguish
          (opacity 0.1) instead of deleting.
        </p>
      </div>
    </aside>
  )
}
