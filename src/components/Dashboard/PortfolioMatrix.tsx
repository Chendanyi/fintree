import { useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { deriveActiveLeafTarget, useTreeStore } from '../../store/useTreeStore'
import type { AssetSnapshot } from '../../types/financialTree'
import clsx from 'clsx'

interface MatrixRow {
  symbol: string
  basePrice: number
  targetPrice: number | null
  upsidePct: number | null
  lockedFacts: string[]
  extinguishedCount: number
}

function buildRow(symbol: string, snapshot: AssetSnapshot): MatrixRow {
  const basePrice = snapshot.treeData.basePrice
  const targetPrice = deriveActiveLeafTarget(snapshot)
  const upsidePct = computeImpliedUpsidePct(basePrice, targetPrice)
  const lockedFacts = snapshot.treeData.nodes
    .filter((n) => n.isLockedFact)
    .map((n) => n.title)

  return {
    symbol,
    basePrice,
    targetPrice,
    upsidePct,
    lockedFacts,
    extinguishedCount: snapshot.extinguishedNodeIds.length,
  }
}

/** Pure upside formula for Portfolio Matrix cells (and unit tests). */
export function computeImpliedUpsidePct(
  basePrice: number,
  targetPrice: number | null,
): number | null {
  if (targetPrice == null || basePrice === 0) return null
  return ((targetPrice - basePrice) / basePrice) * 100
}

export function buildMatrixRow(
  symbol: string,
  snapshot: AssetSnapshot,
): MatrixRow {
  return buildRow(symbol, snapshot)
}

export function PortfolioMatrix() {
  const repository = useTreeStore((s) => s.repository)
  const setActiveSymbol = useTreeStore((s) => s.setActiveSymbol)
  const setView = useTreeStore((s) => s.setView)
  const deleteAsset = useTreeStore((s) => s.deleteAsset)

  const rows = useMemo(
    () =>
      Object.entries(repository)
        .map(([symbol, snap]) => buildRow(symbol, snap))
        .sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [repository],
  )

  const openCanvas = (symbol: string) => {
    setActiveSymbol(symbol)
    setView('canvas')
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-900">
        <div className="mx-6 max-w-lg rounded-2xl border border-slate-800 bg-slate-950/80 px-8 py-10 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-500">
            Portfolio Overview Matrix
          </p>
          <h2 className="mt-3 text-lg font-semibold text-slate-100">
            No assets in the sandbox
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Switch to Decision Canvas and ingest structured financial JSON to
            deploy your first simulation model. Branched scenarios will appear
            here as separate rows.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-900">
      <div className="shrink-0 border-b border-slate-800 px-6 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-400">
          Portfolio Overview Matrix
        </p>
        <h2 className="mt-1 text-sm font-semibold text-slate-100">
          Cross-asset scenario scorecard · {rows.length} model
          {rows.length === 1 ? '' : 's'}
        </h2>
        <p className="mt-1 text-[11px] text-slate-500">
          Click a row to open its Decision Canvas. Metrics reflect each
          snapshot&apos;s current active path.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-slate-900">
            <tr className="border-b border-slate-800 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-6 py-3 font-medium">Ticker / Scenario</th>
              <th className="px-4 py-3 font-medium">Base Price</th>
              <th className="px-4 py-3 font-medium">Target Price</th>
              <th className="px-4 py-3 font-medium">Implied Upside</th>
              <th className="px-4 py-3 font-medium">Locked Facts</th>
              <th className="px-4 py-3 font-medium">Extinguished</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.symbol}
                onClick={() => openCanvas(row.symbol)}
                className="cursor-pointer border-b border-slate-800/80 transition hover:bg-slate-800/40"
              >
                <td className="px-6 py-3.5">
                  <span className="font-medium text-slate-100">
                    {row.symbol}
                  </span>
                </td>
                <td className="px-4 py-3.5 font-mono text-sm text-slate-200">
                  ${row.basePrice.toFixed(2)}
                </td>
                <td className="px-4 py-3.5 font-mono text-sm text-slate-100">
                  {row.targetPrice != null
                    ? `$${row.targetPrice.toFixed(2)}`
                    : '—'}
                </td>
                <td className="px-4 py-3.5 font-mono text-sm font-semibold">
                  {row.upsidePct == null ? (
                    <span className="text-slate-500">—</span>
                  ) : (
                    <span
                      className={clsx(
                        row.upsidePct >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400',
                      )}
                    >
                      {row.upsidePct >= 0 ? '+' : ''}
                      {row.upsidePct.toFixed(1)}%
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  {row.lockedFacts.length === 0 ? (
                    <span className="text-xs text-slate-600">None</span>
                  ) : (
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {row.lockedFacts.map((title) => (
                        <span
                          key={title}
                          className="rounded border border-amber-700/50 bg-amber-950/60 px-1.5 py-0.5 text-[10px] text-amber-300"
                        >
                          {title}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3.5 font-mono text-sm text-slate-300">
                  {row.extinguishedCount}
                </td>
                <td className="px-4 py-3.5">
                  <button
                    type="button"
                    title={`Delete ${row.symbol}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (
                        window.confirm(
                          `Remove "${row.symbol}" from the repository?`,
                        )
                      ) {
                        deleteAsset(row.symbol)
                      }
                    }}
                    className="rounded-md border border-slate-700 p-1.5 text-slate-500 transition hover:border-rose-800/60 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
