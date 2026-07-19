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
  isLockedFact: boolean // If true, alternative branches are permanently pruned
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

export interface TreeStoreState {
  treeData: TreeData | null
  activePathNodeIds: Set<string>
  selectedNodeId: string | null
  extinguishedNodeIds: Set<string>
  mergeError: string | null

  // Operational Actions
  importInitialTree: (data: TreeData) => void
  incrementalMergeTree: (
    newData: Partial<TreeData> & { nodes: FinancialNode[] },
  ) => void
  selectNode: (nodeId: string) => void
  toggleLockFact: (nodeId: string) => void
  pruneAlternativeBranches: (nodeId: string) => void
  clearMergeError: () => void
}
