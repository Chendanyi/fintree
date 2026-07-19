import { useRef } from 'react'
import { ChevronDown, Download, Trash2, Upload } from 'lucide-react'
import { useTreeStore } from '../../store/useTreeStore'
import { getActiveSnapshot } from '../../types/financialTree'

export function HeaderTickerHub() {
  const fileRef = useRef<HTMLInputElement>(null)
  const repository = useTreeStore((s) => s.repository)
  const activeSymbol = useTreeStore((s) => s.activeSymbol)
  const setActiveSymbol = useTreeStore((s) => s.setActiveSymbol)
  const deleteAsset = useTreeStore((s) => s.deleteAsset)
  const exportVault = useTreeStore((s) => s.exportVault)
  const importVault = useTreeStore((s) => s.importVault)

  const symbols = Object.keys(repository)
  const activeSnap = getActiveSnapshot(repository, activeSymbol)
  const pathCount = activeSnap?.activePathNodeIds.length ?? 0

  const onImportFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await file.text()
      importVault(text)
    } catch {
      useTreeStore.setState({
        mergeError: 'Failed to read the selected vault file.',
      })
    }
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {symbols.length === 0 ? (
        <span className="rounded border border-dashed border-slate-700 px-2 py-1 font-mono text-[11px] text-slate-500">
          Repository empty
        </span>
      ) : (
        <>
          <div className="relative">
            <select
              value={activeSymbol ?? ''}
              onChange={(e) => setActiveSymbol(e.target.value)}
              className="max-w-[200px] appearance-none truncate rounded-lg border border-slate-700 bg-slate-900 py-1.5 pl-3 pr-8 font-mono text-xs text-slate-100 outline-none focus:border-emerald-600/60 focus:ring-1 focus:ring-emerald-700/30"
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
            <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 font-mono text-[11px] lg:flex">
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
        </>
      )}

      <button
        type="button"
        title="Export Vault"
        onClick={exportVault}
        className="rounded-md border border-slate-800 px-2 py-1.5 text-slate-400 transition hover:border-emerald-800/60 hover:text-emerald-300"
      >
        <span className="flex items-center gap-1.5 font-mono text-[10px]">
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export Vault</span>
        </span>
      </button>

      <button
        type="button"
        title="Import Vault"
        onClick={() => fileRef.current?.click()}
        className="rounded-md border border-slate-800 px-2 py-1.5 text-slate-400 transition hover:border-sky-800/60 hover:text-sky-300"
      >
        <span className="flex items-center gap-1.5 font-mono text-[10px]">
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Import Vault</span>
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          void onImportFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

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
