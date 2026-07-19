export interface FinancialImpact {
  cagrEffect?: string // e.g., "+15%", "-5%"
  marginEffect?: string // e.g., "-10%"
  revenueEffect?: string // e.g., "+$1.2B"
}

export interface FinancialNode {
  id: string
  lane: string // Chronological tier, matching timelineLanes order
  title: string
  description: string
  isLockedFact: boolean // If true, alternative branches are soft-extinguished
  childrenIds: string[]

  // Terminal Leaf Node Specifics
  targetPrice?: number
  cagr?: string
  netReserveRevenue?: string
  cpnVolume?: string

  // Tactical Intermediate Path Specifics
  financialImpact?: FinancialImpact
}

export interface TreeData {
  stockSymbol: string
  basePrice: number
  lastUpdated: string
  timelineLanes: string[] // e.g., ["2026 H2", "2027", "2028-2029", "2031"]
  nodes: FinancialNode[]
}

export type TreePatch = Partial<TreeData> & { nodes: FinancialNode[] }

export interface TreeStoreState {
  /** Multi-asset repository keyed by stockSymbol */
  stocks: Record<string, TreeData>
  /** Soft-extinguished node IDs per symbol (fact-lock death paths) */
  extinguishedBySymbol: Record<string, Set<string>>
  activeSymbol: string | null
  activePathNodeIds: Set<string>
  selectedNodeId: string | null
  /** Extinguished IDs for the currently active symbol (view projection) */
  extinguishedNodeIds: Set<string>
  mergeError: string | null
  statusToast: string | null

  setActiveSymbol: (symbol: string) => void
  initializeNewStock: (data: TreeData) => void
  mergeStockPatch: (symbol: string, patch: TreePatch) => void
  overwriteStock: (data: TreeData) => void
  deleteStock: (symbol: string) => void

  selectNode: (nodeId: string) => void
  toggleLockFact: (nodeId: string) => void
  pruneAlternativeBranches: (nodeId: string) => void
  clearMergeError: () => void
  clearStatusToast: () => void
}

/** Safe accessor for the active tree graph */
export function getActiveTree(
  stocks: Record<string, TreeData>,
  activeSymbol: string | null,
): TreeData | null {
  if (!activeSymbol) return null
  return stocks[activeSymbol] ?? null
}
