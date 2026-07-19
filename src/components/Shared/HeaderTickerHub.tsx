import { useRef, useState, type ReactNode } from 'react'
import {
  ChevronDown,
  Download,
  GitBranchPlus,
  LayoutDashboard,
  Network,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useTreeStore } from '../../store/useTreeStore'
import { getActiveSnapshot } from '../../types/financialTree'
import type { WorkspaceView } from '../../types/financialTree'
import clsx from 'clsx'

export function ViewSwitcher() {
  const currentView = useTreeStore((s) => s.currentView)
  const setView = useTreeStore((s) => s.setView)

  const btn = (view: WorkspaceView, label: string, icon: ReactNode) => (
    <button
      type="button"
      onClick={() => setView(view)}
      className={clsx(
        'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[10px] transition',
        currentView === view
          ? 'bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-500/40'
          : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200',
      )}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  )

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-slate-800 bg-slate-950/80 p-0.5">
      {btn('canvas', 'Decision Canvas', <Network className="h-3.5 w-3.5" />)}
      {btn(
        'dashboard',
        'Portfolio Matrix',
        <LayoutDashboard className="h-3.5 w-3.5" />,
      )}
    </div>
  )
}

export function HeaderTickerHub() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [cloneName, setCloneName] = useState('')

  const repository = useTreeStore((s) => s.repository)
  const activeSymbol = useTreeStore((s) => s.activeSymbol)
  const setActiveSymbol = useTreeStore((s) => s.setActiveSymbol)
  const deleteAsset = useTreeStore((s) => s.deleteAsset)
  const cloneAsset = useTreeStore((s) => s.cloneAsset)
  const exportVault = useTreeStore((s) => s.exportVault)
  const importVault = useTreeStore((s) => s.importVault)

  const symbols = Object.keys(repository)
  const activeSnap = getActiveSnapshot(repository, activeSymbol)
  const pathCount = activeSnap?.activePathNodeIds.length ?? 0

  const openClone = () => {
    if (!activeSymbol) return
    setCloneName(`${activeSymbol} - Copy`)
    setCloneOpen(true)
  }

  const confirmClone = () => {
    if (!activeSymbol) return
    cloneAsset(activeSymbol, cloneName)
    setCloneOpen(false)
  }

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
              className="max-w-[180px] appearance-none truncate rounded-lg border border-slate-700 bg-slate-900 py-1.5 pl-3 pr-8 font-mono text-xs text-slate-100 outline-none focus:border-emerald-600/60 focus:ring-1 focus:ring-emerald-700/30"
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

          <button
            type="button"
            title="Branch / Clone Scenario"
            onClick={openClone}
            disabled={!activeSymbol}
            className="rounded-md border border-slate-800 px-2 py-1.5 text-slate-400 transition hover:border-amber-800/60 hover:text-amber-300 disabled:opacity-40"
          >
            <span className="flex items-center gap-1.5 font-mono text-[10px]">
              <GitBranchPlus className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Branch</span>
            </span>
          </button>

          {activeSnap && (
            <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 font-mono text-[11px] xl:flex">
              <span className="text-slate-500">Base</span>
              <span className="text-emerald-300">
                ${activeSnap.treeData.basePrice.toFixed(2)}
              </span>
              <span className="text-slate-700">·</span>
              <span className="text-slate-500">Path</span>
              <span className="text-emerald-400">{pathCount}</span>
            </div>
          )}
        </>
      )}

      <button
        type="button"
        title="Export Vault"
        onClick={exportVault}
        className="rounded-md border border-slate-800 px-2 py-1.5 text-slate-400 transition hover:border-emerald-800/60 hover:text-emerald-300"
      >
        <Download className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        title="Import Vault"
        onClick={() => fileRef.current?.click()}
        className="rounded-md border border-slate-800 px-2 py-1.5 text-slate-400 transition hover:border-sky-800/60 hover:text-sky-300"
      >
        <Upload className="h-3.5 w-3.5" />
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

      {cloneOpen && (
        <div className="absolute top-12 right-4 z-50 w-80 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-wider text-amber-400">
              Branch Scenario
            </p>
            <button
              type="button"
              onClick={() => setCloneOpen(false)}
              className="text-slate-500 hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mb-2 text-[11px] text-slate-400">
            Deep-copies the active snapshot (path, locks, extinguished) into a
            new repository key.
          </p>
          <input
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmClone()
            }}
            className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-emerald-600/50"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmClone}
              className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Create Branch
            </button>
            <button
              type="button"
              onClick={() => setCloneOpen(false)}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
