import { useEffect } from 'react'
import { GitBranch } from 'lucide-react'
import { IngestionTerminal } from './components/Panels/IngestionTerminal'
import { ValuationAnalyzer } from './components/Panels/ValuationAnalyzer'
import { DecisionCanvas } from './components/Canvas/DecisionCanvas'
import { useTreeStore } from './store/useTreeStore'
import { MOCK_TREE_DATA } from './data/mockTree'

export default function App() {
  const importInitialTree = useTreeStore((s) => s.importInitialTree)
  const stockSymbol = useTreeStore((s) => s.treeData?.stockSymbol)
  const pathCount = useTreeStore((s) => s.activePathNodeIds.size)

  useEffect(() => {
    importInitialTree(MOCK_TREE_DATA)
  }, [importInitialTree])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/95 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600/20 ring-1 ring-emerald-500/40">
            <GitBranch className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-50">
              FinTree AI
            </h1>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">
              Strategic Path Valuation Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono text-[11px] text-slate-400">
          {stockSymbol && (
            <span className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-slate-200">
              {stockSymbol}
            </span>
          )}
          <span>
            Active Path{' '}
            <span className="text-emerald-400">{pathCount}</span> nodes
          </span>
        </div>
      </header>

      <main className="flex min-h-0 flex-1">
        <IngestionTerminal />
        <section className="min-w-0 flex-1">
          <DecisionCanvas />
        </section>
        <ValuationAnalyzer />
      </main>
    </div>
  )
}
