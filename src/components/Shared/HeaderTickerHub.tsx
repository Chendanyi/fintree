import { ChevronDown, Trash2 } from 'lucide-react'
import { useTreeStore } from '../../store/useTreeStore'
import { getActiveSnapshot } from '../../types/financialTree'

export function HeaderTickerHub() {
  const repository = useTreeStore((s) => s.repository)
  const activeSymbol = useTreeStore((s) => s.activeSymbol)
  const setActiveSymbol = useTreeStore((s) => s.setActiveSymbol)
  const deleteAsset = useTreeStore((s) => s.deleteAsset)

  const symbols = Object.keys(repository)
  const activeSnap = getActiveSnapshot(repository, activeSymbol)
  const pathCount = activeSnap?.activePathNodeIds.length ?? 0

  if (symbols.length === 0) {
    return (
      <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
        <span className="rounded border border-dashed border-slate-700 px-2 py-1">
          Repository empty
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <select
          value={activeSymbol ?? ''}
          onChange={(e) => setActiveSymbol(e.target.value)}
          className="max-w-[220px] appearance-none truncate rounded-lg border border-slate-700 bg-slate-900 py-1.5 pl-3 pr-8 font-mono text-xs text-slate-100 outline-none focus:border-emerald-600/60 focus:ring-1 focus:ring-emerald-700/30"
          aria-label="Select asset snapshot"
        >
          {symbols.map((sym) => (
            <option key={sym} value={sym}>
              {sym}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
      </div>

      {activeSnap && (
        <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 font-mono text-[11px] sm:flex">
          <span className="text-slate-500">Base</span>
          <span className="text-emerald-300">
            ${activeSnap.treeData.basePrice.toFixed(2)}
          </span>
          <span className="text-slate-700">·</span>
          <span className="text-slate-500">Updated</span>
          <span className="text-slate-300">
            {activeSnap.treeData.lastUpdated}
          </span>
        </div>
      )}

      <span className="hidden font-mono text-[11px] text-slate-500 md:inline">
        Path <span className="text-emerald-400">{pathCount}</span>
      </span>

      {activeSymbol && (
        <button
          type="button"
          title={`Remove ${activeSymbol}`}
          onClick={() => {
            if (
              window.confirm(
                `Remove ${activeSymbol} from the snapshot repository?`,
              )
            ) {
              deleteAsset(activeSymbol)
            }
          }}
          className="rounded-md border border-slate-800 p-1.5 text-slate-500 transition hover:border-rose-800/60 hover:text-rose-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
