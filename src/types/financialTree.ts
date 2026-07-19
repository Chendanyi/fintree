export interface FinancialImpact {
  cagrEffect?: string
  marginEffect?: string
  revenueEffect?: string
}

export interface FinancialNode {
  id: string
  lane: string
  title: string
  description: string
  isLockedFact: boolean
  childrenIds: string[]
  targetPrice?: number
  cagr?: string
  netReserveRevenue?: string
  cpnVolume?: string
  financialImpact?: FinancialImpact
}

export interface TreeData {
  stockSymbol: string
  basePrice: number
  lastUpdated: string
  timelineLanes: string[]
  nodes: FinancialNode[]
}

export type TreePatch = Partial<TreeData> & { nodes: FinancialNode[] }

/** Per-ticker graph + independent UI interaction state */
export interface AssetSnapshot {
  treeData: TreeData
  selectedNodeId: string | null
  activePathNodeIds: string[]
  extinguishedNodeIds: string[]
}

export type IngestionRouteStatus = 'NEW_ASSET' | 'CONFLICT' | 'ERROR'

export interface MultiAssetStoreState {
  repository: Record<string, AssetSnapshot>
  activeSymbol: string | null
  mergeError: string | null
  pendingIncomingData: TreeData | null
  statusToast: string | null

  setActiveSymbol: (symbol: string) => void
  processIncomingJson: (jsonText: string) => { status: IngestionRouteStatus }
  executeInitialize: (data: TreeData) => void
  executeIncrementalMerge: (data: TreeData) => void
  clearPendingIncoming: () => void
  deleteAsset: (symbol: string) => void
  clearMergeError: () => void
  clearStatusToast: () => void

  selectNode: (nodeId: string) => void
  toggleLockFact: (nodeId: string) => void
}

export function getActiveSnapshot(
  repository: Record<string, AssetSnapshot>,
  activeSymbol: string | null,
): AssetSnapshot | null {
  if (!activeSymbol) return null
  return repository[activeSymbol] ?? null
}

export function getActiveTree(
  repository: Record<string, AssetSnapshot>,
  activeSymbol: string | null,
): TreeData | null {
  return getActiveSnapshot(repository, activeSymbol)?.treeData ?? null
}
