import { create } from 'zustand'
import type {
  FinancialNode,
  TreeData,
  TreePatch,
  TreeStoreState,
} from '../types/financialTree'
import { getActiveTree } from '../types/financialTree'

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

/** Max targetPrice among non-extinguished descendant leaves. */
function maxLeafWeight(
  nodeId: string,
  nodeMap: Map<string, FinancialNode>,
  extinguished: Set<string>,
): number {
  if (extinguished.has(nodeId)) return 0
  const node = nodeMap.get(nodeId)
  if (!node) return 0
  const liveChildren = node.childrenIds.filter((id) => !extinguished.has(id))
  if (liveChildren.length === 0) {
    return node.targetPrice ?? 0
  }
  return Math.max(
    ...liveChildren.map((id) => maxLeafWeight(id, nodeMap, extinguished)),
    0,
  )
}

/**
 * Algorithm A: Active Path Propagation & Ancestor Tracing
 * Skips soft-extinguished branches when descending.
 */
export function computeActivePath(
  selectedNodeId: string,
  nodes: FinancialNode[],
  extinguished: Set<string> = new Set(),
): Set<string> {
  const nodeMap = buildNodeMap(nodes)
  const parentMap = buildParentMap(nodes)
  const path = new Set<string>()

  if (!nodeMap.has(selectedNodeId) || extinguished.has(selectedNodeId)) {
    return path
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

  return path
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

/**
 * Algorithm B: Incremental JSON Tree Merging (With Memory Retention)
 */
export function mergeTreeData(
  current: TreeData,
  newData: TreePatch,
): { data: TreeData; error: string | null } {
  const nodeMap = new Map(current.nodes.map((n) => [n.id, { ...n }]))

  for (const incoming of newData.nodes) {
    const existing = nodeMap.get(incoming.id)
    if (existing) {
      if (existing.isLockedFact) {
        const healedChildren = Array.from(
          new Set([...existing.childrenIds, ...incoming.childrenIds]),
        )
        nodeMap.set(incoming.id, {
          ...existing,
          childrenIds: healedChildren,
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

  const timelineLanes = Array.from(
    new Set([...current.timelineLanes, ...(newData.timelineLanes ?? [])]),
  )

  return {
    data: {
      stockSymbol: newData.stockSymbol ?? current.stockSymbol,
      basePrice: newData.basePrice ?? current.basePrice,
      lastUpdated: newData.lastUpdated ?? current.lastUpdated,
      timelineLanes,
      nodes: Array.from(nodeMap.values()),
    },
    error: null,
  }
}

/**
 * Algorithm C: Soft-extinguish sibling subtrees (nodes remain in graph).
 */
export function softExtinguishSiblings(
  nodes: FinancialNode[],
  lockedNodeId: string,
  priorExtinguished: Set<string> = new Set(),
): {
  nodes: FinancialNode[]
  extinguished: Set<string>
  revivedOnUnlock?: never
} {
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
    return { nodes: nextNodes, extinguished }
  }

  const parent = nodeMap.get(parentId)!
  const siblings = parent.childrenIds.filter((id) => id !== lockedNodeId)

  for (const siblingId of siblings) {
    const subtree = collectSubtreeIds(siblingId, nodeMap)
    for (const id of subtree) {
      extinguished.add(id)
    }
  }

  return { nodes: nextNodes, extinguished }
}

/** On unlock: revive sibling subtrees that were extinguished by this lock. */
export function reviveSiblingSubtrees(
  nodes: FinancialNode[],
  unlockedNodeId: string,
  extinguished: Set<string>,
): Set<string> {
  const parentMap = buildParentMap(nodes)
  const nodeMap = buildNodeMap(nodes)
  const parentId = parentMap.get(unlockedNodeId)
  if (!parentId) return new Set(extinguished)

  const parent = nodeMap.get(parentId)
  if (!parent) return new Set(extinguished)

  const siblings = parent.childrenIds.filter((id) => id !== unlockedNodeId)
  const revived = new Set(extinguished)
  for (const siblingId of siblings) {
    const subtree = collectSubtreeIds(siblingId, nodeMap)
    for (const id of subtree) {
      revived.delete(id)
    }
  }
  return revived
}

function projectViewState(
  tree: TreeData,
  extinguished: Set<string>,
  preferredSelected?: string | null,
): {
  selectedNodeId: string | null
  activePathNodeIds: Set<string>
} {
  const livePreferred =
    preferredSelected &&
    tree.nodes.some((n) => n.id === preferredSelected) &&
    !extinguished.has(preferredSelected)
      ? preferredSelected
      : null

  const selectedNodeId = livePreferred ?? findRootId(tree.nodes)
  const activePathNodeIds = selectedNodeId
    ? computeActivePath(selectedNodeId, tree.nodes, extinguished)
    : new Set<string>()

  return { selectedNodeId, activePathNodeIds }
}

export const useTreeStore = create<TreeStoreState>((set, get) => ({
  stocks: {},
  extinguishedBySymbol: {},
  activeSymbol: null,
  activePathNodeIds: new Set(),
  selectedNodeId: null,
  extinguishedNodeIds: new Set(),
  mergeError: null,
  statusToast: null,

  clearMergeError: () => set({ mergeError: null }),
  clearStatusToast: () => set({ statusToast: null }),

  setActiveSymbol: (symbol) => {
    const { stocks, extinguishedBySymbol, selectedNodeId } = get()
    const tree = stocks[symbol]
    if (!tree) {
      set({ mergeError: `Unknown symbol: ${symbol}` })
      return
    }
    const extinguished = extinguishedBySymbol[symbol] ?? new Set()
    const view = projectViewState(tree, extinguished, selectedNodeId)
    set({
      activeSymbol: symbol,
      extinguishedNodeIds: new Set(extinguished),
      mergeError: null,
      ...view,
    })
  },

  initializeNewStock: (data) => {
    const symbol = data.stockSymbol
    const clone = structuredClone(data)
    const view = projectViewState(clone, new Set())

    set((state) => ({
      stocks: { ...state.stocks, [symbol]: clone },
      extinguishedBySymbol: {
        ...state.extinguishedBySymbol,
        [symbol]: new Set(),
      },
      activeSymbol: symbol,
      extinguishedNodeIds: new Set(),
      mergeError: null,
      statusToast: `Successfully initialized new asset: ${symbol}`,
      ...view,
    }))
  },

  overwriteStock: (data) => {
    const symbol = data.stockSymbol
    const clone = structuredClone(data)
    const view = projectViewState(clone, new Set())

    set((state) => ({
      stocks: { ...state.stocks, [symbol]: clone },
      extinguishedBySymbol: {
        ...state.extinguishedBySymbol,
        [symbol]: new Set(),
      },
      activeSymbol: symbol,
      extinguishedNodeIds: new Set(),
      mergeError: null,
      statusToast: `Overwrote asset model: ${symbol}`,
      ...view,
    }))
  },

  mergeStockPatch: (symbol, patch) => {
    const current = get().stocks[symbol]
    if (!current) {
      set({
        mergeError: `No tree for ${symbol}. Initialize the asset first.`,
      })
      return
    }

    const { data, error } = mergeTreeData(current, patch)
    if (error) {
      set({ mergeError: error })
      return
    }

    // If patch renames symbol key, keep repository key stable to `symbol`
    const stored: TreeData = { ...data, stockSymbol: symbol }
    const extinguished =
      get().extinguishedBySymbol[symbol] ?? new Set<string>()
    const view = projectViewState(stored, extinguished, get().selectedNodeId)

    set((state) => ({
      stocks: { ...state.stocks, [symbol]: stored },
      activeSymbol: symbol,
      extinguishedNodeIds: new Set(extinguished),
      mergeError: null,
      statusToast: `Smart merge applied to ${symbol}`,
      ...view,
    }))
  },

  deleteStock: (symbol) => {
    const { stocks, extinguishedBySymbol, activeSymbol } = get()
    if (!stocks[symbol]) return

    const nextStocks = { ...stocks }
    delete nextStocks[symbol]
    const nextExt = { ...extinguishedBySymbol }
    delete nextExt[symbol]

    const remaining = Object.keys(nextStocks)
    if (activeSymbol === symbol) {
      if (remaining.length === 0) {
        set({
          stocks: nextStocks,
          extinguishedBySymbol: nextExt,
          activeSymbol: null,
          selectedNodeId: null,
          activePathNodeIds: new Set(),
          extinguishedNodeIds: new Set(),
          statusToast: `Removed ${symbol} from repository`,
        })
        return
      }
      const nextSymbol = remaining[0]
      const tree = nextStocks[nextSymbol]
      const extinguished = nextExt[nextSymbol] ?? new Set()
      const view = projectViewState(tree, extinguished)
      set({
        stocks: nextStocks,
        extinguishedBySymbol: nextExt,
        activeSymbol: nextSymbol,
        extinguishedNodeIds: new Set(extinguished),
        statusToast: `Removed ${symbol}. Switched to ${nextSymbol}`,
        ...view,
      })
      return
    }

    set({
      stocks: nextStocks,
      extinguishedBySymbol: nextExt,
      statusToast: `Removed ${symbol} from repository`,
    })
  },

  selectNode: (nodeId) => {
    const { stocks, activeSymbol, extinguishedNodeIds } = get()
    const tree = getActiveTree(stocks, activeSymbol)
    if (!tree) return
    if (extinguishedNodeIds.has(nodeId)) return
    if (!tree.nodes.some((n) => n.id === nodeId)) return

    set({
      selectedNodeId: nodeId,
      activePathNodeIds: computeActivePath(
        nodeId,
        tree.nodes,
        extinguishedNodeIds,
      ),
    })
  },

  pruneAlternativeBranches: (nodeId) => {
    const { stocks, activeSymbol, extinguishedBySymbol } = get()
    const tree = getActiveTree(stocks, activeSymbol)
    if (!tree || !activeSymbol) return

    const prior = extinguishedBySymbol[activeSymbol] ?? new Set()
    const { nodes, extinguished } = softExtinguishSiblings(
      tree.nodes,
      nodeId,
      prior,
    )
    const nextTree = { ...tree, nodes }
    const view = projectViewState(nextTree, extinguished, nodeId)

    set((state) => ({
      stocks: { ...state.stocks, [activeSymbol]: nextTree },
      extinguishedBySymbol: {
        ...state.extinguishedBySymbol,
        [activeSymbol]: extinguished,
      },
      extinguishedNodeIds: new Set(extinguished),
      ...view,
    }))
  },

  toggleLockFact: (nodeId) => {
    const { stocks, activeSymbol, extinguishedBySymbol } = get()
    const tree = getActiveTree(stocks, activeSymbol)
    if (!tree || !activeSymbol) return
    if ((extinguishedBySymbol[activeSymbol] ?? new Set()).has(nodeId)) return

    const target = tree.nodes.find((n) => n.id === nodeId)
    if (!target) return

    if (!target.isLockedFact) {
      get().pruneAlternativeBranches(nodeId)
      return
    }

    // Unlock — clear fact flag and revive soft-extinguished siblings
    const prior = extinguishedBySymbol[activeSymbol] ?? new Set()
    const revived = reviveSiblingSubtrees(tree.nodes, nodeId, prior)
    const nodes = tree.nodes.map((n) =>
      n.id === nodeId ? { ...n, isLockedFact: false } : n,
    )
    const nextTree = { ...tree, nodes }
    const view = projectViewState(
      nextTree,
      revived,
      get().selectedNodeId ?? nodeId,
    )

    set((state) => ({
      stocks: { ...state.stocks, [activeSymbol]: nextTree },
      extinguishedBySymbol: {
        ...state.extinguishedBySymbol,
        [activeSymbol]: revived,
      },
      extinguishedNodeIds: new Set(revived),
      ...view,
    }))
  },
}))
