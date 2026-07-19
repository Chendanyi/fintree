import { create } from 'zustand'
import type {
  AssetSnapshot,
  FinancialNode,
  MultiAssetStoreState,
  TreeData,
  TreePatch,
} from '../types/financialTree'
import { getActiveSnapshot } from '../types/financialTree'

function buildParentMap(nodes: FinancialNode[]): Map<string, string> {
  const parentMap = new Map<string, string>()
  for (const node of nodes) {
    for (const childId of node.childrenIds) {
      parentMap.set(childId, node.id)
    }
  }
  return parentMap
}

function buildNodeMap(nodes: FinancialNode[]): Map<string, FinancialNode> {
  return new Map(nodes.map((n) => [n.id, n]))
}

function findRootId(nodes: FinancialNode[]): string | null {
  const parentMap = buildParentMap(nodes)
  return nodes.find((n) => !parentMap.has(n.id))?.id ?? nodes[0]?.id ?? null
}

function maxLeafWeight(
  nodeId: string,
  nodeMap: Map<string, FinancialNode>,
  extinguished: Set<string>,
): number {
  if (extinguished.has(nodeId)) return 0
  const node = nodeMap.get(nodeId)
  if (!node) return 0
  const liveChildren = node.childrenIds.filter((id) => !extinguished.has(id))
  if (liveChildren.length === 0) return node.targetPrice ?? 0
  return Math.max(
    ...liveChildren.map((id) => maxLeafWeight(id, nodeMap, extinguished)),
    0,
  )
}

/** Active path: ancestors to root, then heaviest live leaf descent. */
export function computeActivePath(
  selectedNodeId: string,
  nodes: FinancialNode[],
  extinguished: Set<string> = new Set(),
): string[] {
  const nodeMap = buildNodeMap(nodes)
  const parentMap = buildParentMap(nodes)
  const path = new Set<string>()

  if (!nodeMap.has(selectedNodeId) || extinguished.has(selectedNodeId)) {
    return []
  }

  let current: string | undefined = selectedNodeId
  while (current) {
    path.add(current)
    current = parentMap.get(current)
  }

  let cursor = selectedNodeId
  while (true) {
    const node = nodeMap.get(cursor)
    if (!node) break
    const liveChildren = node.childrenIds.filter((id) => !extinguished.has(id))
    if (liveChildren.length === 0) break

    let bestChild = liveChildren[0]
    let bestWeight = maxLeafWeight(bestChild, nodeMap, extinguished)
    for (let i = 1; i < liveChildren.length; i++) {
      const childId = liveChildren[i]
      const weight = maxLeafWeight(childId, nodeMap, extinguished)
      if (weight > bestWeight) {
        bestWeight = weight
        bestChild = childId
      }
    }
    path.add(bestChild)
    cursor = bestChild
  }

  return Array.from(path)
}

function collectSubtreeIds(
  nodeId: string,
  nodeMap: Map<string, FinancialNode>,
): Set<string> {
  const ids = new Set<string>()
  const stack = [nodeId]
  while (stack.length) {
    const id = stack.pop()!
    if (ids.has(id)) continue
    ids.add(id)
    const node = nodeMap.get(id)
    if (node) stack.push(...node.childrenIds)
  }
  return ids
}

function deepMergeNode(
  existing: FinancialNode,
  incoming: FinancialNode,
): FinancialNode {
  return {
    ...existing,
    ...incoming,
    childrenIds: Array.from(
      new Set([...existing.childrenIds, ...incoming.childrenIds]),
    ),
    financialImpact: {
      ...existing.financialImpact,
      ...incoming.financialImpact,
    },
  }
}

export function mergeTreeData(
  current: TreeData,
  newData: TreePatch,
): { data: TreeData; error: string | null } {
  const nodeMap = new Map(current.nodes.map((n) => [n.id, { ...n }]))

  for (const incoming of newData.nodes) {
    const existing = nodeMap.get(incoming.id)
    if (existing) {
      if (existing.isLockedFact) {
        nodeMap.set(incoming.id, {
          ...existing,
          childrenIds: Array.from(
            new Set([...existing.childrenIds, ...incoming.childrenIds]),
          ),
        })
      } else {
        nodeMap.set(incoming.id, deepMergeNode(existing, incoming))
      }
    } else {
      nodeMap.set(incoming.id, { ...incoming })
    }
  }

  for (const node of nodeMap.values()) {
    const uniqueKids = Array.from(new Set(node.childrenIds))
    const validKids = uniqueKids.filter((id) => nodeMap.has(id))
    if (validKids.length !== uniqueKids.length) {
      const orphans = uniqueKids.filter((id) => !nodeMap.has(id))
      return {
        data: current,
        error: `Orphaned childrenIds detected: ${orphans.join(', ')} on node ${node.id}`,
      }
    }
    node.childrenIds = validKids
  }

  for (const incoming of newData.nodes) {
    for (const candidate of newData.nodes) {
      if (candidate.childrenIds.includes(incoming.id)) {
        const parent = nodeMap.get(candidate.id)
        if (parent && !parent.childrenIds.includes(incoming.id)) {
          parent.childrenIds = [...parent.childrenIds, incoming.id]
        }
      }
    }
  }

  return {
    data: {
      stockSymbol: newData.stockSymbol ?? current.stockSymbol,
      basePrice: newData.basePrice ?? current.basePrice,
      lastUpdated: newData.lastUpdated ?? current.lastUpdated,
      timelineLanes: Array.from(
        new Set([...current.timelineLanes, ...(newData.timelineLanes ?? [])]),
      ),
      nodes: Array.from(nodeMap.values()),
    },
    error: null,
  }
}

export function softExtinguishSiblings(
  nodes: FinancialNode[],
  lockedNodeId: string,
  priorExtinguished: string[],
): { nodes: FinancialNode[]; extinguishedNodeIds: string[] } {
  const nextNodes = nodes.map((n) => ({
    ...n,
    childrenIds: [...n.childrenIds],
    isLockedFact: n.id === lockedNodeId ? true : n.isLockedFact,
  }))
  const nodeMap = buildNodeMap(nextNodes)
  const parentMap = buildParentMap(nextNodes)
  const extinguished = new Set(priorExtinguished)

  const parentId = parentMap.get(lockedNodeId)
  if (!parentId) {
    return { nodes: nextNodes, extinguishedNodeIds: Array.from(extinguished) }
  }

  const parent = nodeMap.get(parentId)!
  for (const siblingId of parent.childrenIds.filter((id) => id !== lockedNodeId)) {
    for (const id of collectSubtreeIds(siblingId, nodeMap)) {
      extinguished.add(id)
    }
  }

  return { nodes: nextNodes, extinguishedNodeIds: Array.from(extinguished) }
}

export function reviveSiblingSubtrees(
  nodes: FinancialNode[],
  unlockedNodeId: string,
  extinguished: string[],
): string[] {
  const parentMap = buildParentMap(nodes)
  const nodeMap = buildNodeMap(nodes)
  const parentId = parentMap.get(unlockedNodeId)
  if (!parentId) return [...extinguished]

  const parent = nodeMap.get(parentId)
  if (!parent) return [...extinguished]

  const revived = new Set(extinguished)
  for (const siblingId of parent.childrenIds.filter((id) => id !== unlockedNodeId)) {
    for (const id of collectSubtreeIds(siblingId, nodeMap)) {
      revived.delete(id)
    }
  }
  return Array.from(revived)
}

function buildPristineSnapshot(data: TreeData): AssetSnapshot {
  const treeData = structuredClone(data)
  const selectedNodeId = findRootId(treeData.nodes)
  const activePathNodeIds = selectedNodeId
    ? computeActivePath(selectedNodeId, treeData.nodes, new Set())
    : []
  return {
    treeData,
    selectedNodeId,
    activePathNodeIds,
    extinguishedNodeIds: [],
  }
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function parseAndValidateFullTree(
  jsonText: string,
): { ok: true; data: TreeData } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    if (!parsed.stockSymbol || typeof parsed.stockSymbol !== 'string') {
      return { ok: false, error: 'JSON must include a string "stockSymbol".' }
    }
    if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
      return { ok: false, error: 'JSON must include a "nodes" array.' }
    }

    const basePrice = coerceNumber(parsed.basePrice)
    if (basePrice == null) {
      return {
        ok: false,
        error:
          'JSON must include numeric "basePrice" (e.g. 65.69 — not "65.69" in quotes, and not missing).',
      }
    }

    if (!parsed.timelineLanes || !Array.isArray(parsed.timelineLanes)) {
      return {
        ok: false,
        error: 'JSON must include a "timelineLanes" array.',
      }
    }

    const lastUpdated =
      typeof parsed.lastUpdated === 'string'
        ? parsed.lastUpdated
        : new Date().toISOString().slice(0, 10)

    return {
      ok: true,
      data: {
        stockSymbol: parsed.stockSymbol,
        basePrice,
        lastUpdated,
        timelineLanes: parsed.timelineLanes as string[],
        nodes: parsed.nodes as TreeData['nodes'],
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Invalid JSON syntax',
    }
  }
}

function updateActiveSnapshot(
  state: MultiAssetStoreState,
  mutator: (snap: AssetSnapshot) => AssetSnapshot,
): Partial<MultiAssetStoreState> | null {
  const { activeSymbol, repository } = state
  if (!activeSymbol) return null
  const current = repository[activeSymbol]
  if (!current) return null
  return {
    repository: {
      ...repository,
      [activeSymbol]: mutator(current),
    },
  }
}

export const useTreeStore = create<MultiAssetStoreState>((set, get) => ({
  repository: {},
  activeSymbol: null,
  mergeError: null,
  pendingIncomingData: null,
  statusToast: null,

  clearMergeError: () => set({ mergeError: null }),
  clearStatusToast: () => set({ statusToast: null }),
  clearPendingIncoming: () =>
    set({ pendingIncomingData: null, mergeError: null }),

  setActiveSymbol: (symbol) => {
    const { repository } = get()
    if (!repository[symbol]) {
      set({ mergeError: `Unknown symbol: ${symbol}` })
      return
    }
    set({
      activeSymbol: symbol,
      pendingIncomingData: null,
      mergeError: null,
    })
  },

  /**
   * Algorithm A — Ingestion Router Pipeline
   * NEW_ASSET → pristine snapshot; CONFLICT → stage pendingIncomingData.
   */
  processIncomingJson: (jsonText) => {
    const parsed = parseAndValidateFullTree(jsonText)
    if (!parsed.ok) {
      set({
        mergeError: parsed.error,
        pendingIncomingData: null,
      })
      return { status: 'ERROR' }
    }

    const data = parsed.data
    const symbol = data.stockSymbol
    const exists = Boolean(get().repository[symbol])

    if (!exists) {
      const snapshot = buildPristineSnapshot(data)
      set((state) => ({
        repository: { ...state.repository, [symbol]: snapshot },
        activeSymbol: symbol,
        pendingIncomingData: null,
        mergeError: null,
        statusToast: `Successfully initialized new asset: ${symbol}`,
      }))
      return { status: 'NEW_ASSET' }
    }

    // Conflict — do not mutate repository yet
    set({
      pendingIncomingData: data,
      mergeError: null,
    })
    return { status: 'CONFLICT' }
  },

  /** Fresh overwrite / first-time write for a symbol */
  executeInitialize: (data) => {
    const symbol = data.stockSymbol
    const snapshot = buildPristineSnapshot(data)
    set((state) => ({
      repository: { ...state.repository, [symbol]: snapshot },
      activeSymbol: symbol,
      pendingIncomingData: null,
      mergeError: null,
      statusToast: state.repository[symbol]
        ? `Overwrote asset model: ${symbol}`
        : `Successfully initialized new asset: ${symbol}`,
    }))
  },

  /** Smart merge into existing snapshot — keeps locks, path, extinguish state */
  executeIncrementalMerge: (data) => {
    const symbol = data.stockSymbol
    const existing = get().repository[symbol]
    if (!existing) {
      set({
        mergeError: `No snapshot for ${symbol}. Initialize first.`,
        pendingIncomingData: null,
      })
      return
    }

    const { data: merged, error } = mergeTreeData(existing.treeData, data)
    if (error) {
      set({ mergeError: error })
      return
    }

    const storedTree: TreeData = { ...merged, stockSymbol: symbol }
    const extinguished = new Set(existing.extinguishedNodeIds)
    const preferred =
      existing.selectedNodeId &&
      storedTree.nodes.some((n) => n.id === existing.selectedNodeId) &&
      !extinguished.has(existing.selectedNodeId)
        ? existing.selectedNodeId
        : findRootId(storedTree.nodes)

    const activePathNodeIds = preferred
      ? computeActivePath(preferred, storedTree.nodes, extinguished)
      : []

    set((state) => ({
      repository: {
        ...state.repository,
        [symbol]: {
          treeData: storedTree,
          selectedNodeId: preferred,
          activePathNodeIds,
          extinguishedNodeIds: existing.extinguishedNodeIds,
        },
      },
      activeSymbol: symbol,
      pendingIncomingData: null,
      mergeError: null,
      statusToast: `Smart merge applied to ${symbol}`,
    }))
  },

  deleteAsset: (symbol) => {
    const { repository, activeSymbol } = get()
    if (!repository[symbol]) return

    const nextRepo = { ...repository }
    delete nextRepo[symbol]
    const remaining = Object.keys(nextRepo)

    if (activeSymbol === symbol) {
      if (remaining.length === 0) {
        set({
          repository: nextRepo,
          activeSymbol: null,
          pendingIncomingData: null,
          statusToast: `Removed ${symbol} from repository`,
        })
        return
      }
      set({
        repository: nextRepo,
        activeSymbol: remaining[0],
        pendingIncomingData: null,
        statusToast: `Removed ${symbol}. Switched to ${remaining[0]}`,
      })
      return
    }

    set({
      repository: nextRepo,
      statusToast: `Removed ${symbol} from repository`,
    })
  },

  selectNode: (nodeId) => {
    const state = get()
    if (!state.activeSymbol) return
    const snap = getActiveSnapshot(state.repository, state.activeSymbol)
    if (!snap) return
    if (snap.extinguishedNodeIds.includes(nodeId)) return
    if (!snap.treeData.nodes.some((n) => n.id === nodeId)) return

    const activePathNodeIds = computeActivePath(
      nodeId,
      snap.treeData.nodes,
      new Set(snap.extinguishedNodeIds),
    )

    const patch = updateActiveSnapshot(state, (s) => ({
      ...s,
      selectedNodeId: nodeId,
      activePathNodeIds,
    }))
    if (patch) set(patch)
  },

  toggleLockFact: (nodeId) => {
    const state = get()
    if (!state.activeSymbol) return
    const snap = getActiveSnapshot(state.repository, state.activeSymbol)
    if (!snap) return
    if (snap.extinguishedNodeIds.includes(nodeId)) return

    const target = snap.treeData.nodes.find((n) => n.id === nodeId)
    if (!target) return

    if (!target.isLockedFact) {
      const { nodes, extinguishedNodeIds } = softExtinguishSiblings(
        snap.treeData.nodes,
        nodeId,
        snap.extinguishedNodeIds,
      )
      const activePathNodeIds = computeActivePath(
        nodeId,
        nodes,
        new Set(extinguishedNodeIds),
      )
      const patch = updateActiveSnapshot(state, (s) => ({
        treeData: { ...s.treeData, nodes },
        selectedNodeId: nodeId,
        activePathNodeIds,
        extinguishedNodeIds,
      }))
      if (patch) set(patch)
      return
    }

    const extinguishedNodeIds = reviveSiblingSubtrees(
      snap.treeData.nodes,
      nodeId,
      snap.extinguishedNodeIds,
    )
    const nodes = snap.treeData.nodes.map((n) =>
      n.id === nodeId ? { ...n, isLockedFact: false } : n,
    )
    const selectedNodeId = snap.selectedNodeId ?? nodeId
    const activePathNodeIds = computeActivePath(
      selectedNodeId,
      nodes,
      new Set(extinguishedNodeIds),
    )
    const patch = updateActiveSnapshot(state, (s) => ({
      treeData: { ...s.treeData, nodes },
      selectedNodeId,
      activePathNodeIds,
      extinguishedNodeIds,
    }))
    if (patch) set(patch)
  },
}))
