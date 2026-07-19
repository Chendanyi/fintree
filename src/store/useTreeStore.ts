import { create } from 'zustand'
import type {
  AssetSnapshot,
  FinancialNode,
  MultiAssetStoreState,
  TreeData,
  TreePatch,
} from '../types/financialTree'
import {
  STORAGE_REPO_KEY,
  STORAGE_SYMBOL_KEY,
  TOPOLOGY_LOOP_ERROR,
  getActiveSnapshot,
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

function findRootId(nodes: FinancialNode[]): string | null {
  const parentMap = buildParentMap(nodes)
  return nodes.find((n) => !parentMap.has(n.id))?.id ?? nodes[0]?.id ?? null
}

/**
 * Feature A — DAG cycle detection (edges: parent → child via childrenIds).
 * Returns true if a directed cycle exists.
 */
export function detectCycle(nodes: FinancialNode[]): boolean {
  const nodeMap = buildNodeMap(nodes)
  const visiting = new Set<string>()
  const visited = new Set<string>()

  const dfs = (id: string): boolean => {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    const node = nodeMap.get(id)
    if (node) {
      for (const childId of node.childrenIds) {
        if (!nodeMap.has(childId)) continue
        if (dfs(childId)) return true
      }
    }
    visiting.delete(id)
    visited.add(id)
    return false
  }

  for (const node of nodes) {
    if (!visited.has(node.id) && dfs(node.id)) return true
  }
  return false
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

/** Active path with visited guard against accidental cycles. */
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
  const upGuard = new Set<string>()
  while (current) {
    if (upGuard.has(current)) break
    upGuard.add(current)
    path.add(current)
    current = parentMap.get(current)
  }

  let cursor = selectedNodeId
  const downGuard = new Set<string>()
  while (true) {
    if (downGuard.has(cursor)) break
    downGuard.add(cursor)
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

/**
 * Feature B — merge node fields; always preserve existing isLockedFact.
 * Structural childrenIds: union (append new branches); locked nodes only graft children.
 */
function deepMergeNodePreservingLock(
  existing: FinancialNode,
  incoming: FinancialNode,
): FinancialNode {
  const mergedChildren = Array.from(
    new Set([...existing.childrenIds, ...incoming.childrenIds]),
  )
  return {
    ...existing,
    ...incoming,
    isLockedFact: existing.isLockedFact,
    childrenIds: mergedChildren,
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
        // Preserve lock + all fields; only graft new childrenIds
        nodeMap.set(incoming.id, {
          ...existing,
          childrenIds: Array.from(
            new Set([...existing.childrenIds, ...incoming.childrenIds]),
          ),
        })
      } else {
        nodeMap.set(
          incoming.id,
          deepMergeNodePreservingLock(existing, incoming),
        )
      }
    } else {
      // New branches start unlocked
      nodeMap.set(incoming.id, { ...incoming, isLockedFact: false })
    }
  }

  // Parent pointer healing from patch: ensure declared children links exist
  for (const candidate of newData.nodes) {
    for (const childId of candidate.childrenIds ?? []) {
      const parent = nodeMap.get(candidate.id)
      if (parent && nodeMap.has(childId) && !parent.childrenIds.includes(childId)) {
        parent.childrenIds = [...parent.childrenIds, childId]
      }
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

  const merged: TreeData = {
    stockSymbol: newData.stockSymbol ?? current.stockSymbol,
    basePrice: newData.basePrice ?? current.basePrice,
    lastUpdated: newData.lastUpdated ?? current.lastUpdated,
    timelineLanes: Array.from(
      new Set([...current.timelineLanes, ...(newData.timelineLanes ?? [])]),
    ),
    nodes: Array.from(nodeMap.values()),
  }

  if (detectCycle(merged.nodes)) {
    return { data: current, error: TOPOLOGY_LOOP_ERROR }
  }

  return { data: merged, error: null }
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

/** Re-evaluate extinguish set from locked facts after topology changes. */
export function reevaluateExtinguished(
  nodes: FinancialNode[],
  priorExtinguished: string[],
): string[] {
  const nodeIds = new Set(nodes.map((n) => n.id))
  let extinguished = new Set(priorExtinguished.filter((id) => nodeIds.has(id)))

  for (const node of nodes) {
    if (!node.isLockedFact) continue
    const { extinguishedNodeIds } = softExtinguishSiblings(
      nodes,
      node.id,
      Array.from(extinguished),
    )
    extinguished = new Set(extinguishedNodeIds)
  }

  return Array.from(extinguished)
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

    // Coerce basePrice before DAG / further checks
    const basePrice = coerceNumber(parsed.basePrice)
    if (basePrice == null) {
      return {
        ok: false,
        error:
          'JSON must include numeric "basePrice" (e.g. 65.69 — not missing).',
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

    const data: TreeData = {
      stockSymbol: parsed.stockSymbol,
      basePrice,
      lastUpdated,
      timelineLanes: parsed.timelineLanes as string[],
      nodes: parsed.nodes as TreeData['nodes'],
    }

    if (detectCycle(data.nodes)) {
      return { ok: false, error: TOPOLOGY_LOOP_ERROR }
    }

    return { ok: true, data }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Invalid JSON syntax',
    }
  }
}

function isAssetSnapshot(value: unknown): value is AssetSnapshot {
  if (!value || typeof value !== 'object') return false
  const snap = value as Record<string, unknown>
  if (!snap.treeData || typeof snap.treeData !== 'object') return false
  const tree = snap.treeData as Record<string, unknown>
  if (typeof tree.stockSymbol !== 'string') return false
  if (!Array.isArray(tree.nodes)) return false
  if (!Array.isArray(snap.activePathNodeIds)) return false
  if (!Array.isArray(snap.extinguishedNodeIds)) return false
  return true
}

export function isRepositoryPayload(
  value: unknown,
): value is Record<string, AssetSnapshot> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return false
  return entries.every(([key, snap]) => {
    if (typeof key !== 'string' || !key) return false
    return isAssetSnapshot(snap)
  })
}

/** Feature C — safe localStorage read */
export function loadPersistedState(): {
  repository: Record<string, AssetSnapshot>
  activeSymbol: string | null
} {
  try {
    const raw = localStorage.getItem(STORAGE_REPO_KEY)
    const symbolRaw = localStorage.getItem(STORAGE_SYMBOL_KEY)
    if (!raw) {
      return { repository: {}, activeSymbol: null }
    }
    const parsed: unknown = JSON.parse(raw)
    if (!isRepositoryPayload(parsed)) {
      return { repository: {}, activeSymbol: null }
    }
    const activeSymbol =
      symbolRaw && parsed[symbolRaw] ? symbolRaw : Object.keys(parsed)[0] ?? null
    return { repository: parsed, activeSymbol }
  } catch {
    return { repository: {}, activeSymbol: null }
  }
}

/** Feature C — safe localStorage write */
export function persistSandboxState(
  repository: Record<string, AssetSnapshot>,
  activeSymbol: string | null,
): { ok: boolean; error?: string } {
  try {
    localStorage.setItem(STORAGE_REPO_KEY, JSON.stringify(repository))
    localStorage.setItem(STORAGE_SYMBOL_KEY, activeSymbol ?? '')
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? `Persistence failed: ${e.message}`
          : 'Persistence failed (storage quota?).',
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

const hydrated = loadPersistedState()

/** Derive terminal targetPrice along the snapshot's active path. */
export function deriveActiveLeafTarget(snapshot: AssetSnapshot): number | null {
  const active = new Set(snapshot.activePathNodeIds)
  const extinguished = new Set(snapshot.extinguishedNodeIds)
  const leaf = snapshot.treeData.nodes.find(
    (n) =>
      active.has(n.id) &&
      !extinguished.has(n.id) &&
      n.childrenIds.length === 0 &&
      n.targetPrice != null,
  )
  return leaf?.targetPrice ?? null
}

export const useTreeStore = create<MultiAssetStoreState>((set, get) => ({
  repository: hydrated.repository,
  activeSymbol: hydrated.activeSymbol,
  currentView: 'canvas',
  mergeError: null,
  pendingIncomingData: null,
  statusToast: null,

  clearMergeError: () => set({ mergeError: null }),
  clearStatusToast: () => set({ statusToast: null }),
  clearPendingIncoming: () =>
    set({ pendingIncomingData: null, mergeError: null }),

  setView: (view) => set({ currentView: view }),

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

  cloneAsset: (sourceSymbol, newSymbolName) => {
    const trimmed = newSymbolName.trim()
    if (!trimmed) {
      set({ mergeError: 'Clone failed: scenario name cannot be empty.' })
      return
    }
    const { repository } = get()
    const source = repository[sourceSymbol]
    if (!source) {
      set({ mergeError: `Clone failed: unknown source "${sourceSymbol}".` })
      return
    }
    if (repository[trimmed]) {
      set({
        mergeError: `Clone failed: "${trimmed}" already exists in the repository.`,
      })
      return
    }

    const cloned: AssetSnapshot = structuredClone(source)
    cloned.treeData = {
      ...cloned.treeData,
      stockSymbol: trimmed,
    }

    set((state) => ({
      repository: { ...state.repository, [trimmed]: cloned },
      activeSymbol: trimmed,
      currentView: 'canvas',
      pendingIncomingData: null,
      mergeError: null,
      statusToast: `Branched scenario: ${trimmed}`,
    }))
  },

  processIncomingJson: (jsonText) => {
    const parsed = parseAndValidateFullTree(jsonText)
    if (!parsed.ok) {
      set({
        mergeError: parsed.error,
        pendingIncomingData: null,
      })
      return { status: 'ERROR' }
    }

    // Cycle already checked inside parse (after basePrice coercion)
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

    set({
      pendingIncomingData: data,
      mergeError: null,
    })
    return { status: 'CONFLICT' }
  },

  executeInitialize: (data) => {
    if (detectCycle(data.nodes)) {
      set({
        mergeError: TOPOLOGY_LOOP_ERROR,
        pendingIncomingData: null,
      })
      return
    }
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

    if (detectCycle(data.nodes)) {
      set({ mergeError: TOPOLOGY_LOOP_ERROR })
      return
    }

    const { data: merged, error } = mergeTreeData(existing.treeData, data)
    if (error) {
      set({ mergeError: error })
      return
    }

    const storedTree: TreeData = { ...merged, stockSymbol: symbol }

    // Preserve extinguish membership; re-evaluate from locked facts after topology change
    const extinguishedNodeIds = reevaluateExtinguished(
      storedTree.nodes,
      existing.extinguishedNodeIds,
    )
    const extinguished = new Set(extinguishedNodeIds)

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
          extinguishedNodeIds,
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

  exportVault: () => {
    const { repository } = get()
    try {
      const blob = new Blob([JSON.stringify(repository, null, 2)], {
        type: 'application/json',
      })
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fintree-sandbox-session-${stamp}.json`
      a.click()
      URL.revokeObjectURL(url)
      set({ statusToast: 'Vault exported to download' })
    } catch (e) {
      set({
        mergeError:
          e instanceof Error ? e.message : 'Failed to export vault session.',
      })
    }
  },

  importVault: (jsonText) => {
    try {
      const parsed: unknown = JSON.parse(jsonText)
      if (!isRepositoryPayload(parsed)) {
        const msg =
          'Import failed: file must be a Record<stockSymbol, AssetSnapshot>.'
        set({ mergeError: msg })
        return { ok: false, error: msg }
      }
      const symbols = Object.keys(parsed)
      const activeSymbol = symbols[0] ?? null
      set({
        repository: parsed,
        activeSymbol,
        pendingIncomingData: null,
        mergeError: null,
        statusToast: `Imported vault (${symbols.length} asset${symbols.length === 1 ? '' : 's'})`,
      })
      const persisted = persistSandboxState(parsed, activeSymbol)
      if (!persisted.ok) {
        set({ mergeError: persisted.error ?? 'Persistence failed after import.' })
      }
      return { ok: true }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Invalid JSON in vault import.'
      set({ mergeError: msg })
      return { ok: false, error: msg }
    }
  },
}))

/** Feature C — reactive persistence after repository / activeSymbol changes */
useTreeStore.subscribe((state, prev) => {
  if (
    state.repository === prev.repository &&
    state.activeSymbol === prev.activeSymbol
  ) {
    return
  }
  const result = persistSandboxState(state.repository, state.activeSymbol)
  if (!result.ok && result.error) {
    // Avoid recursive loops: only set error if different
    const current = useTreeStore.getState().mergeError
    if (current !== result.error) {
      useTreeStore.setState({ mergeError: result.error })
    }
  }
})
