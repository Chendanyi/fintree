import { create } from 'zustand'
import type {
  FinancialNode,
  TreeData,
  TreeStoreState,
} from '../types/financialTree'

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

/** Max targetPrice among descendant leaves (inclusive). */
function maxLeafWeight(
  nodeId: string,
  nodeMap: Map<string, FinancialNode>,
): number {
  const node = nodeMap.get(nodeId)
  if (!node) return 0
  if (node.childrenIds.length === 0) {
    return node.targetPrice ?? 0
  }
  return Math.max(
    ...node.childrenIds.map((id) => maxLeafWeight(id, nodeMap)),
    0,
  )
}

/**
 * Algorithm A: Active Path Propagation & Ancestor Tracing
 * Down-up: ancestors to root. Up-down: heaviest leaf path.
 */
export function computeActivePath(
  selectedNodeId: string,
  nodes: FinancialNode[],
): Set<string> {
  const nodeMap = buildNodeMap(nodes)
  const parentMap = buildParentMap(nodes)
  const path = new Set<string>()

  if (!nodeMap.has(selectedNodeId)) return path

  // Down-up traversal to root
  let current: string | undefined = selectedNodeId
  while (current) {
    path.add(current)
    current = parentMap.get(current)
  }

  // Up-down traversal toward highest-weight leaf
  let cursor = selectedNodeId
  while (true) {
    const node = nodeMap.get(cursor)
    if (!node || node.childrenIds.length === 0) break

    let bestChild = node.childrenIds[0]
    let bestWeight = maxLeafWeight(bestChild, nodeMap)

    for (let i = 1; i < node.childrenIds.length; i++) {
      const childId = node.childrenIds[i]
      const weight = maxLeafWeight(childId, nodeMap)
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
  newData: Partial<TreeData> & { nodes: FinancialNode[] },
): { data: TreeData; error: string | null } {
  const nodeMap = new Map(current.nodes.map((n) => [n.id, { ...n }]))

  for (const incoming of newData.nodes) {
    const existing = nodeMap.get(incoming.id)
    if (existing) {
      if (existing.isLockedFact) {
        // Locked facts cannot be overridden — only allow childrenIds grafting
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

  // Parent pointer healing: ensure parents list new children
  for (const incoming of newData.nodes) {
    for (const [parentId, parent] of nodeMap) {
      if (
        parent.childrenIds.includes(incoming.id) ||
        incoming.id === parentId
      ) {
        continue
      }
    }
  }

  // Heal: if any node references a child, parent must include it.
  // Also scan incoming nodes that declare themselves as children via merge —
  // when appending, callers may only send the child; parent healing below
  // syncs childrenIds when parents already reference them.
  for (const node of nodeMap.values()) {
    const uniqueKids = Array.from(new Set(node.childrenIds))
    // Drop dangling refs to missing nodes (orphaned childrenIds)
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

  // Secondary heal: if a newly appended node appears in some parent's
  // intended children list from incoming patch parents
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
    new Set([
      ...current.timelineLanes,
      ...(newData.timelineLanes ?? []),
    ]),
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
 * Algorithm C: Sibling Pruning & Fact Freezing
 */
export function pruneSiblings(
  nodes: FinancialNode[],
  lockedNodeId: string,
): { nodes: FinancialNode[]; extinguished: Set<string> } {
  const nodeMap = buildNodeMap(nodes.map((n) => ({ ...n, childrenIds: [...n.childrenIds] })))
  const parentMap = buildParentMap(nodes)
  const extinguished = new Set<string>()

  const parentId = parentMap.get(lockedNodeId)
  if (!parentId) {
    // Root lock — freeze in place, no siblings
    const root = nodeMap.get(lockedNodeId)
    if (root) root.isLockedFact = true
    return { nodes: Array.from(nodeMap.values()), extinguished }
  }

  const parent = nodeMap.get(parentId)!
  const siblings = parent.childrenIds.filter((id) => id !== lockedNodeId)

  for (const siblingId of siblings) {
    const subtree = collectSubtreeIds(siblingId, nodeMap)
    for (const id of subtree) {
      extinguished.add(id)
      nodeMap.delete(id)
    }
  }

  parent.childrenIds = parent.childrenIds.filter((id) => id === lockedNodeId)

  const locked = nodeMap.get(lockedNodeId)
  if (locked) locked.isLockedFact = true

  return { nodes: Array.from(nodeMap.values()), extinguished }
}

export const useTreeStore = create<TreeStoreState>((set, get) => ({
  treeData: null,
  activePathNodeIds: new Set(),
  selectedNodeId: null,
  extinguishedNodeIds: new Set(),
  mergeError: null,

  clearMergeError: () => set({ mergeError: null }),

  importInitialTree: (data) => {
    const root =
      data.nodes.find((n) => {
        const parentMap = buildParentMap(data.nodes)
        return !parentMap.has(n.id)
      }) ?? data.nodes[0]

    const selectedId = root?.id ?? null
    const activePathNodeIds = selectedId
      ? computeActivePath(selectedId, data.nodes)
      : new Set<string>()

    set({
      treeData: structuredClone(data),
      selectedNodeId: selectedId,
      activePathNodeIds,
      extinguishedNodeIds: new Set(),
      mergeError: null,
    })
  },

  incrementalMergeTree: (newData) => {
    const current = get().treeData
    if (!current) {
      set({ mergeError: 'No tree loaded. Initialize a tree first.' })
      return
    }

    const { data, error } = mergeTreeData(current, newData)
    if (error) {
      set({ mergeError: error })
      return
    }

    const selectedId = get().selectedNodeId
    const stillExists =
      selectedId && data.nodes.some((n) => n.id === selectedId)
    const nextSelected =
      stillExists
        ? selectedId!
        : (data.nodes.find((n) => {
            const parentMap = buildParentMap(data.nodes)
            return !parentMap.has(n.id)
          })?.id ?? null)

    set({
      treeData: data,
      mergeError: null,
      selectedNodeId: nextSelected,
      activePathNodeIds: nextSelected
        ? computeActivePath(nextSelected, data.nodes)
        : new Set(),
    })
  },

  selectNode: (nodeId) => {
    const { treeData } = get()
    if (!treeData) return
    if (!treeData.nodes.some((n) => n.id === nodeId)) return

    set({
      selectedNodeId: nodeId,
      activePathNodeIds: computeActivePath(nodeId, treeData.nodes),
    })
  },

  pruneAlternativeBranches: (nodeId) => {
    const { treeData, extinguishedNodeIds } = get()
    if (!treeData) return

    const { nodes, extinguished } = pruneSiblings(treeData.nodes, nodeId)
    const mergedExtinguished = new Set([
      ...extinguishedNodeIds,
      ...extinguished,
    ])

    const selectedId = get().selectedNodeId
    const stillExists =
      selectedId && nodes.some((n) => n.id === selectedId)
    const nextSelected = stillExists ? selectedId! : nodeId

    set({
      treeData: { ...treeData, nodes },
      extinguishedNodeIds: mergedExtinguished,
      selectedNodeId: nextSelected,
      activePathNodeIds: computeActivePath(nextSelected, nodes),
    })
  },

  toggleLockFact: (nodeId) => {
    const { treeData } = get()
    if (!treeData) return

    const target = treeData.nodes.find((n) => n.id === nodeId)
    if (!target) return

    if (!target.isLockedFact) {
      // Lock → Algorithm C prune
      get().pruneAlternativeBranches(nodeId)
      return
    }

    // Unlock — restore flag only (pruned branches stay extinguished)
    const nodes = treeData.nodes.map((n) =>
      n.id === nodeId ? { ...n, isLockedFact: false } : n,
    )
    set({
      treeData: { ...treeData, nodes },
      activePathNodeIds: computeActivePath(
        get().selectedNodeId ?? nodeId,
        nodes,
      ),
    })
  },
}))
