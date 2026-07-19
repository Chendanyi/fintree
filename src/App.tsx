import { useEffect } from 'react'
import { CheckCircle2, GitBranch, X } from 'lucide-react'
import { IngestionTerminal } from './components/Panels/IngestionTerminal'
import { ValuationAnalyzer } from './components/Panels/ValuationAnalyzer'
import { DecisionCanvas } from './components/Canvas/DecisionCanvas'
import { HeaderTickerHub } from './components/Shared/HeaderTickerHub'
import { useTreeStore } from './store/useTreeStore'

function StatusToast() {
  const statusToast = useTreeStore((s) => s.statusToast)
  const clearStatusToast = useTreeStore((s) => s.clearStatusToast)

  useEffect(() => {
    if (!statusToast) return
    const timer = window.setTimeout(() => clearStatusToast(), 3500)
    return () => window.clearTimeout(timer)
  }, [statusToast, clearStatusToast])

  if (!statusToast) return null

  return (
    <div className="pointer-events-none fixed top-16 right-4 z-50 max-w-sm">
      <div className="pointer-events-auto flex items-start gap-2 rounded-xl border border-emerald-700/50 bg-slate-900/95 px-4 py-3 shadow-xl backdrop-blur">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        <p className="flex-1 text-xs leading-relaxed text-emerald-100">
          {statusToast}
        </p>
        <button
          type="button"
          onClick={clearStatusToast}
          className="text-slate-500 hover:text-slate-300"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/95 px-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-600/20 ring-1 ring-emerald-500/40">
            <GitBranch className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-slate-50">
              FinTree AI
            </h1>
            <p className="truncate font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">
              Multi-Asset Research Repository
            </p>
          </div>
        </div>

        <HeaderTickerHub />
      </header>

      <main className="flex min-h-0 flex-1">
        <IngestionTerminal />
        <section className="min-w-0 flex-1">
          <DecisionCanvas />
        </section>
        <ValuationAnalyzer />
      </main>

      <StatusToast />
    </div>
  )
}
