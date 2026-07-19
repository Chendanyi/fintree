import type { Edge, Node } from '@xyflow/react'
import type { FinancialNode, TreeData } from '../types/financialTree'

export const LANE_WIDTH = 320
export const NODE_HEIGHT_GAP = 200
export const LANE_PADDING_X = 40
export const LANE_PADDING_Y = 80

export interface DecisionNodeData extends Record<string, unknown> {
  financial: FinancialNode
  isActive: boolean
  isSelected: boolean
}

/**
 * Timeline-band auto-layout: columns = timelineLanes, rows stack within lane.
 */
export function layoutTreeToFlow(
  treeData: TreeData,
  activePathNodeIds: Set<string>,
  selectedNodeId: string | null,
): { nodes: Node<DecisionNodeData>[]; edges: Edge[] } {
  const laneIndex = new Map(
    treeData.timelineLanes.map((lane, i) => [lane, i]),
  )

  const laneBuckets = new Map<string, FinancialNode[]>()
  for (const lane of treeData.timelineLanes) {
    laneBuckets.set(lane, [])
  }

  for (const node of treeData.nodes) {
    const bucket = laneBuckets.get(node.lane)
    if (bucket) {
      bucket.push(node)
    } else {
      // Unknown lane — append dynamically
      laneBuckets.set(node.lane, [node])
    }
  }

  const flowNodes: Node<DecisionNodeData>[] = []

  for (const [lane, nodesInLane] of laneBuckets) {
    const col = laneIndex.get(lane) ?? treeData.timelineLanes.length
    nodesInLane.forEach((financial, row) => {
      flowNodes.push({
        id: financial.id,
        type: 'decision',
        position: {
          x: col * LANE_WIDTH + LANE_PADDING_X,
          y: row * NODE_HEIGHT_GAP + LANE_PADDING_Y,
        },
        data: {
          financial,
          isActive: activePathNodeIds.has(financial.id),
          isSelected: selectedNodeId === financial.id,
        },
        style: {
          opacity: activePathNodeIds.has(financial.id) ? 1 : 0.25,
        },
      })
    })
  }

  const nodeIds = new Set(treeData.nodes.map((n) => n.id))
  const edges: Edge[] = []

  for (const node of treeData.nodes) {
    for (const childId of node.childrenIds) {
      if (!nodeIds.has(childId)) continue
      const onPath =
        activePathNodeIds.has(node.id) && activePathNodeIds.has(childId)
      edges.push({
        id: `${node.id}->${childId}`,
        source: node.id,
        target: childId,
        animated: onPath,
        style: {
          stroke: onPath ? '#10b981' : '#334155',
          strokeWidth: onPath ? 2.5 : 1.5,
          opacity: onPath ? 1 : 0.25,
        },
      })
    }
  }

  return { nodes: flowNodes, edges }
}

export function getCanvasWidth(laneCount: number): number {
  return Math.max(laneCount, 1) * LANE_WIDTH + LANE_PADDING_X * 2
}
