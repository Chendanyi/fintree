import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  computeImpliedUpsidePct,
  PortfolioMatrix,
} from '../../components/Dashboard/PortfolioMatrix'
import { makeCrclTree, makeSnapshot } from '../../test/fixtures'

vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
})

const { useTreeStore } = await import('../../store/useTreeStore')

function putSnapshot(opts: {
  basePrice: number
  leafId: 'leaf_bull' | 'leaf_bear'
  targetPrice: number
  path: string[]
}) {
  const tree = makeCrclTree()
  tree.basePrice = opts.basePrice
  const leaf = tree.nodes.find((n) => n.id === opts.leafId)!
  leaf.targetPrice = opts.targetPrice

  const snap = makeSnapshot(tree, {
    selectedNodeId: opts.leafId,
    activePathNodeIds: opts.path,
    extinguishedNodeIds: [],
  })

  useTreeStore.setState({
    repository: { [tree.stockSymbol]: snap },
    activeSymbol: tree.stockSymbol,
    currentView: 'dashboard',
    mergeError: null,
    pendingIncomingData: null,
    statusToast: null,
  })

  return tree.stockSymbol
}

describe('Formula Derivation Verification', () => {
  it('computes Implied Upside percent exactly from target and base', () => {
    const base = 65.69
    const target = 243
    const expected = ((target - base) / base) * 100
    expect(computeImpliedUpsidePct(base, target)).toBeCloseTo(expected, 10)
  })

  it('renders positive upside with emerald-400 and negative with rose-400', () => {
    putSnapshot({
      basePrice: 100,
      leafId: 'leaf_bull',
      targetPrice: 150,
      path: ['node_root', 'path_a', 'leaf_bull'],
    })
    const { unmount } = render(<PortfolioMatrix />)
    expect(screen.getByText(/\+50\.0%/).className).toContain('text-emerald-400')
    unmount()

    putSnapshot({
      basePrice: 100,
      leafId: 'leaf_bear',
      targetPrice: 80,
      path: ['node_root', 'path_b', 'leaf_bear'],
    })
    render(<PortfolioMatrix />)
    expect(screen.getByText(/-20\.0%/).className).toContain('text-rose-400')
  })
})

describe('Interactive Router Verification', () => {
  beforeEach(() => {
    useTreeStore.setState({
      repository: {},
      activeSymbol: null,
      currentView: 'dashboard',
      mergeError: null,
      pendingIncomingData: null,
      statusToast: null,
    })
  })

  it('row click runs setActiveSymbol then setView canvas', async () => {
    const user = userEvent.setup()
    const symbol = putSnapshot({
      basePrice: 65.69,
      leafId: 'leaf_bull',
      targetPrice: 243,
      path: ['node_root', 'path_a', 'leaf_bull'],
    })
    // Force a symbol transition so the activeSymbol change is observable
    useTreeStore.setState({ activeSymbol: null, currentView: 'dashboard' })

    const order: string[] = []
    const unsub = useTreeStore.subscribe((state, prev) => {
      if (state.activeSymbol !== prev.activeSymbol) {
        order.push('setActiveSymbol')
      }
      if (state.currentView !== prev.currentView) {
        order.push(`setView:${state.currentView}`)
      }
    })

    render(<PortfolioMatrix />)
    await user.click(screen.getByText(symbol))

    expect(order).toEqual(['setActiveSymbol', 'setView:canvas'])
    expect(useTreeStore.getState().activeSymbol).toBe(symbol)
    expect(useTreeStore.getState().currentView).toBe('canvas')
    unsub()
  })
})
