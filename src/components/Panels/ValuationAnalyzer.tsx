import { useMemo } from 'react'
import { TrendingDown, TrendingUp, Activity } from 'lucide-react'
import { useTreeStore } from '../../store/useTreeStore'
import type { FinancialNode } from '../../types/financialTree'
import { getActiveSnapshot } from '../../types/financialTree'
import clsx from 'clsx'

function parseCagrPercent(cagr?: string): number {
  if (!cagr) return 0
  const match = cagr.match(/-?\d+(\.\d+)?/)
  return match ? Number(match[0]) : 0
}

function GaugeBar({
  label,
  value,
  max,
  tone,
}: {
  label: string
  value: number
  max: number
  tone: 'positive' | 'negative' | 'neutral'
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-400">{label}</span>
        <span
          className={clsx(
            'font-mono font-semibold',
            tone === 'positive' && 'text-emerald-400',
            tone === 'negative' && 'text-rose-400',
            tone === 'neutral' && 'text-slate-300',
          )}
        >
          {value.toFixed(1)}
          {label.includes('CAGR') ? '%' : ''}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-500',
            tone === 'positive' && 'bg-emerald-500',
            tone === 'negative' && 'bg-rose-500',
            tone === 'neutral' && 'bg-sky-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function ValuationAnalyzer() {
  const repository = useTreeStore((s) => s.repository)
  const activeSymbol = useTreeStore((s) => s.activeSymbol)

  const snapshot = getActiveSnapshot(repository, activeSymbol)
  const treeData = snapshot?.treeData ?? null

  const analysis = useMemo(() => {
    if (!snapshot || !treeData) return null

    const extinguished = new Set(snapshot.extinguishedNodeIds)
    const activePath = new Set(snapshot.activePathNodeIds)

    const liveNodes = treeData.nodes.filter((n) => !extinguished.has(n.id))
    const activeNodes = liveNodes.filter((n) => activePath.has(n.id))
    const leaf =
      activeNodes.find(
        (n) => n.childrenIds.length === 0 && n.targetPrice != null,
      ) ?? null

    const bullLeaf = liveNodes
      .filter((n) => n.targetPrice != null)
      .sort((a, b) => (b.targetPrice ?? 0) - (a.targetPrice ?? 0))[0] as
      | FinancialNode
      | undefined

    const targetPrice = leaf?.targetPrice ?? null
    const returnRate =
      targetPrice != null
        ? ((targetPrice - treeData.basePrice) / treeData.basePrice) * 100
        : null

    const activeCagr = parseCagrPercent(leaf?.cagr)
    const bullCagr = parseCagrPercent(bullLeaf?.cagr)

    let marginScore = 50
    for (const n of activeNodes) {
      const m = n.financialImpact?.marginEffect ?? ''
      if (m.includes('-') || m.includes('压缩')) marginScore -= 15
      else if (m.includes('+') || m.includes('维持')) marginScore += 5
    }
    marginScore = Math.min(100, Math.max(0, marginScore))

    const bullMargin = 85

    return {
      leaf,
      targetPrice,
      returnRate,
      activeCagr,
      bullCagr: bullCagr || 40,
      marginScore,
      bullMargin,
    }
  }, [snapshot, treeData])

  if (!treeData || !analysis) {
    return (
      <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-slate-800 bg-slate-950">
        <header className="border-b border-slate-800 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-500">
            Valuation Analyzer
          </p>
          <h2 className="mt-0.5 text-sm font-semibold text-slate-100">
            Awaiting Path Selection
          </h2>
        </header>
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-slate-600">
          Load an asset model to unlock dynamic valuation metrics.
        </div>
      </aside>
    )
  }

  const { leaf, targetPrice, returnRate, activeCagr, bullCagr, marginScore, bullMargin } =
    analysis
  const isPositive = (returnRate ?? 0) >= 0

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-slate-800 bg-slate-950">
      <header className="border-b border-slate-800 px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-500">
          Valuation Analyzer
        </p>
        <h2 className="mt-0.5 text-sm font-semibold text-slate-100">
          Path Scorecard
        </h2>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* Macro Matrix */}
        <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
            Macro Matrix
          </p>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Ticker</span>
              <span className="text-right font-medium text-slate-200">
                {treeData.stockSymbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Base Price</span>
              <span className="font-mono text-slate-200">
                ${treeData.basePrice.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Active Leaf</span>
              <span className="max-w-[160px] truncate text-right text-emerald-400">
                {leaf?.title ?? '—'}
              </span>
            </div>
          </div>
        </section>

        {/* Hero Target Price */}
        <section className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
            Projected Target Price
          </p>
          <p
            className={clsx(
              'mt-2 font-mono text-4xl font-bold tracking-tight',
              isPositive ? 'text-emerald-400' : 'text-rose-400',
            )}
          >
            {targetPrice != null ? `$${targetPrice.toFixed(2)}` : '—'}
          </p>

          <div className="mt-3 flex items-center gap-2">
            {returnRate != null &&
              (isPositive ? (
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-rose-400" />
              ))}
            <span
              className={clsx(
                'font-mono text-lg font-semibold',
                isPositive ? 'text-emerald-400' : 'text-rose-400',
              )}
            >
              {returnRate != null
                ? `${returnRate >= 0 ? '+' : ''}${returnRate.toFixed(1)}%`
                : '—'}
            </span>
            <span className="text-[11px] text-slate-500">vs base</span>
          </div>

          {leaf && (
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-800 pt-3 text-[11px]">
              <div>
                <p className="text-slate-500">CAGR</p>
                <p className="font-mono text-slate-200">{leaf.cagr ?? '—'}</p>
              </div>
              <div>
                <p className="text-slate-500">Net Reserve Rev</p>
                <p className="font-mono text-slate-200">
                  {leaf.netReserveRevenue ?? '—'}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500">CPN Volume</p>
                <p className="font-mono text-slate-200">
                  {leaf.cpnVolume ?? '—'}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Gauges */}
        <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-sky-400" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Vs Bull Case
            </p>
          </div>
          <GaugeBar
            label="5-Year CAGR"
            value={activeCagr}
            max={bullCagr}
            tone={activeCagr >= bullCagr * 0.7 ? 'positive' : activeCagr < 15 ? 'negative' : 'neutral'}
          />
          <GaugeBar
            label="Projected Margin Index"
            value={marginScore}
            max={bullMargin}
            tone={
              marginScore >= 70
                ? 'positive'
                : marginScore < 40
                  ? 'negative'
                  : 'neutral'
            }
          />
        </section>
      </div>
    </aside>
  )
}
