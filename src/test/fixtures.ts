import type { AssetSnapshot, FinancialNode, TreeData } from '../../types/financialTree'

export function makeNode(
  partial: Partial<FinancialNode> & Pick<FinancialNode, 'id' | 'lane' | 'title'>,
): FinancialNode {
  return {
    description: partial.description ?? '',
    isLockedFact: partial.isLockedFact ?? false,
    childrenIds: partial.childrenIds ?? [],
    ...partial,
  }
}

/** Acyclic CRCL-like mini tree */
export function makeCrclTree(): TreeData {
  return {
    stockSymbol: 'CRCL.N (Circle Internet Group)',
    basePrice: 65.69,
    lastUpdated: '2026-07-19',
    timelineLanes: ['2026 H2', '2027', '2031'],
    nodes: [
      makeNode({
        id: 'node_root',
        lane: '2026 H2',
        title: 'Visa & Stripe OUSD Launch',
        isLockedFact: true,
        childrenIds: ['path_a', 'path_b'],
      }),
      makeNode({
        id: 'path_a',
        lane: '2027',
        title: 'Path A',
        childrenIds: ['leaf_bull'],
      }),
      makeNode({
        id: 'path_b',
        lane: '2027',
        title: 'Path B',
        childrenIds: ['leaf_bear'],
      }),
      makeNode({
        id: 'leaf_bull',
        lane: '2031',
        title: 'Bull Case',
        targetPrice: 243,
        cagr: '40%',
        childrenIds: [],
      }),
      makeNode({
        id: 'leaf_bear',
        lane: '2031',
        title: 'Bear Case',
        targetPrice: 52,
        cagr: '5%',
        childrenIds: [],
      }),
    ],
  }
}

/** Acyclic NVDA mini tree */
export function makeNvdaTree(): TreeData {
  return {
    stockSymbol: 'NVDA (NVIDIA Corporation)',
    basePrice: 120.5,
    lastUpdated: '2026-07-19',
    timelineLanes: ['2027', '2030'],
    nodes: [
      makeNode({
        id: 'nvda_root',
        lane: '2027',
        title: 'Compute monopoly path',
        childrenIds: ['nvda_leaf'],
      }),
      makeNode({
        id: 'nvda_leaf',
        lane: '2030',
        title: 'Super Bull',
        targetPrice: 450,
        cagr: '50%',
        childrenIds: [],
      }),
    ],
  }
}

export function makeSnapshot(
  treeData: TreeData,
  overrides: Partial<AssetSnapshot> = {},
): AssetSnapshot {
  return {
    treeData,
    selectedNodeId: treeData.nodes[0]?.id ?? null,
    activePathNodeIds: treeData.nodes.map((n) => n.id),
    extinguishedNodeIds: [],
    ...overrides,
  }
}

/** A ↔ B cycle via childrenIds */
export function makeCyclicNodes(): FinancialNode[] {
  return [
    makeNode({ id: 'A', lane: '2026', title: 'A', childrenIds: ['B'] }),
    makeNode({ id: 'B', lane: '2027', title: 'B', childrenIds: ['A'] }),
  ]
}
