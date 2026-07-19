import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  STORAGE_REPO_KEY,
  STORAGE_SYMBOL_KEY,
} from '../../types/financialTree'
import { makeCrclTree, makeNvdaTree, makeSnapshot } from '../../test/fixtures'

function createMemoryLocalStorage() {
  const map = new Map<string, string>()
  return {
    getItem: vi.fn((key: string) => map.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      map.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      map.delete(key)
    }),
    clear: vi.fn(() => {
      map.clear()
    }),
    get _map() {
      return map
    },
  }
}

const memory = createMemoryLocalStorage()
vi.stubGlobal('localStorage', memory)

// Import store AFTER localStorage stub so hydration sees the mock
const { useTreeStore, persistSandboxState } = await import('../useTreeStore')

function resetStore() {
  useTreeStore.setState({
    repository: {},
    activeSymbol: null,
    currentView: 'canvas',
    mergeError: null,
    pendingIncomingData: null,
    statusToast: null,
  })
  memory.clear()
  memory.setItem.mockClear()
  memory.getItem.mockClear()
}

describe('Multi-Asset Snapshot Repository', () => {
  beforeEach(() => {
    resetStore()
  })

  it('keeps NVDA mutations isolated from the CRCL snapshot boundary', () => {
    const crcl = makeCrclTree()
    const nvda = makeNvdaTree()

    useTreeStore.getState().executeInitialize(crcl)
    useTreeStore.getState().executeInitialize(nvda)

    useTreeStore.getState().setActiveSymbol('NVDA (NVIDIA Corporation)')
    useTreeStore.getState().selectNode('nvda_leaf')
    useTreeStore.getState().toggleLockFact('nvda_root')

    const state = useTreeStore.getState()
    const crclSnap = state.repository['CRCL.N (Circle Internet Group)']
    const nvdaSnap = state.repository['NVDA (NVIDIA Corporation)']

    expect(crclSnap).toBeDefined()
    expect(nvdaSnap).toBeDefined()
    expect(crclSnap.selectedNodeId).not.toBe('nvda_leaf')
    expect(crclSnap.treeData.nodes.find((n) => n.id === 'node_root')?.isLockedFact).toBe(
      true,
    )
    expect(nvdaSnap.treeData.nodes.find((n) => n.id === 'nvda_root')?.isLockedFact).toBe(
      true,
    )
    expect(crclSnap.treeData.basePrice).toBe(65.69)
    expect(nvdaSnap.treeData.basePrice).toBe(120.5)
  })

  it('cloneAsset deep-copies so locking the branch leaves the source untainted', () => {
    const crcl = makeCrclTree()
    useTreeStore.getState().executeInitialize(crcl)

    useTreeStore
      .getState()
      .cloneAsset('CRCL.N (Circle Internet Group)', 'CRCL.N - Bull Stress')

    const branchKey = 'CRCL.N - Bull Stress'
    useTreeStore.getState().setActiveSymbol(branchKey)
    useTreeStore.getState().toggleLockFact('path_a')

    const state = useTreeStore.getState()
    const source = state.repository['CRCL.N (Circle Internet Group)']
    const branch = state.repository[branchKey]

    expect(branch).toBeDefined()
    expect(source.treeData.nodes.find((n) => n.id === 'path_a')?.isLockedFact).toBe(
      false,
    )
    expect(branch.treeData.nodes.find((n) => n.id === 'path_a')?.isLockedFact).toBe(
      true,
    )
    expect(branch.extinguishedNodeIds.length).toBeGreaterThan(0)
    expect(source.extinguishedNodeIds.length).toBe(0)
  })
})

describe('Hydration and Storage Guard', () => {
  beforeEach(() => {
    resetStore()
  })

  it('reactively persists repository JSON via localStorage.setItem on mutations', () => {
    useTreeStore.getState().executeInitialize(makeCrclTree())

    expect(memory.setItem).toHaveBeenCalled()
    const repoCalls = memory.setItem.mock.calls.filter(
      ([key]) => key === STORAGE_REPO_KEY,
    )
    expect(repoCalls.length).toBeGreaterThan(0)

    const lastPayload = repoCalls[repoCalls.length - 1][1] as string
    const parsed = JSON.parse(lastPayload) as Record<string, unknown>
    expect(parsed['CRCL.N (Circle Internet Group)']).toBeDefined()

    const symbolCalls = memory.setItem.mock.calls.filter(
      ([key]) => key === STORAGE_SYMBOL_KEY,
    )
    expect(symbolCalls.length).toBeGreaterThan(0)
  })

  it('catches QuotaExceededError in persistSandboxState without crashing', () => {
    const quotaError = new DOMException(
      'The quota has been exceeded.',
      'QuotaExceededError',
    )
    memory.setItem.mockImplementationOnce(() => {
      throw quotaError
    })

    const result = persistSandboxState(
      {
        CRCL: makeSnapshot(makeCrclTree()),
      },
      'CRCL',
    )

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Persistence failed/i)
    expect(() =>
      useTreeStore.getState().executeInitialize(makeNvdaTree()),
    ).not.toThrow()
  })
})
