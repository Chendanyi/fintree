import { useState } from 'react'
import { AlertTriangle, GitMerge, Upload } from 'lucide-react'
import { useTreeStore } from '../../store/useTreeStore'
import { MOCK_TREE_DATA } from '../../data/mockTree'
import type { FinancialNode, TreeData } from '../../types/financialTree'

const SAMPLE_JSON = JSON.stringify(MOCK_TREE_DATA, null, 2)

export function IngestionTerminal() {
  const [rawJson, setRawJson] = useState(SAMPLE_JSON)
  const [localError, setLocalError] = useState<string | null>(null)

  const importInitialTree = useTreeStore((s) => s.importInitialTree)
  const incrementalMergeTree = useTreeStore((s) => s.incrementalMergeTree)
  const mergeError = useTreeStore((s) => s.mergeError)
  const clearMergeError = useTreeStore((s) => s.clearMergeError)
  const lastUpdated = useTreeStore((s) => s.treeData?.lastUpdated)

  const parsePayload = ():
    | { ok: true; data: Partial<TreeData> & { nodes: FinancialNode[] } }
    | { ok: false; error: string } => {
    try {
      const parsed = JSON.parse(rawJson) as Partial<TreeData> & {
        nodes?: FinancialNode[]
      }
      if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
        return { ok: false, error: 'JSON must include a "nodes" array.' }
      }
      return { ok: true, data: parsed as Partial<TreeData> & { nodes: FinancialNode[] } }
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Invalid JSON syntax',
      }
    }
  }

  const handleInitialize = () => {
    clearMergeError()
    const result = parsePayload()
    if (!result.ok) {
      setLocalError(result.error)
      return
    }
    const data = result.data
    if (
      !data.stockSymbol ||
      data.basePrice == null ||
      !data.timelineLanes ||
      !data.nodes
    ) {
      setLocalError(
        'Initialize requires stockSymbol, basePrice, timelineLanes, and nodes.',
      )
      return
    }
    setLocalError(null)
    importInitialTree(data as TreeData)
  }

  const handleMerge = () => {
    clearMergeError()
    const result = parsePayload()
    if (!result.ok) {
      setLocalError(result.error)
      return
    }
    setLocalError(null)
    incrementalMergeTree(result.data)
  }

  const error = localError ?? mergeError

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-r border-slate-800 bg-slate-950">
      <header className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-500">
              Ingestion Terminal
            </p>
            <h2 className="mt-0.5 text-sm font-semibold text-slate-100">
              Tree Data Stream
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
          }}
          spellCheck={false}
          className="min-h-0 flex-1 resize-none rounded-lg border border-slate-800 bg-slate-900/80 p-3 font-mono text-[11px] leading-relaxed text-emerald-200/90 outline-none focus:border-emerald-700/50 focus:ring-1 focus:ring-emerald-700/30"
          placeholder="Paste TreeData JSON…"
        />

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-800/60 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="font-mono leading-relaxed">{error}</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleInitialize}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 active:scale-[0.98]"
          >
            <Upload className="h-3.5 w-3.5" />
            Initialize Tree
          </button>
          <button
            type="button"
            onClick={handleMerge}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 active:scale-[0.98]"
          >
            <GitMerge className="h-3.5 w-3.5" />
            Incremental Merge Update
          </button>
        </div>

        <p className="font-mono text-[10px] leading-relaxed text-slate-600">
          Tip: double-click a node to lock it as historical fact and prune
          sibling branches.
        </p>
      </div>
    </aside>
  )
}
