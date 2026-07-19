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
  isExtinguished: boolean
}

/**
 * Timeline-band auto-layout: columns = timelineLanes, rows stack within lane.
 * Soft-extinguished nodes stay visible at opacity 0.1.
 */
export function layoutTreeToFlow(
  treeData: TreeData,
  activePathNodeIds: Set<string>,
  selectedNodeId: string | null,
  extinguishedNodeIds: Set<string> = new Set(),
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
      laneBuckets.set(node.lane, [node])
    }
  }

  const flowNodes: Node<DecisionNodeData>[] = []

  for (const [lane, nodesInLane] of laneBuckets) {
    const col = laneIndex.get(lane) ?? treeData.timelineLanes.length
    nodesInLane.forEach((financial, row) => {
      const isExtinguished = extinguishedNodeIds.has(financial.id)
      const isActive =
        !isExtinguished && activePathNodeIds.has(financial.id)

      flowNodes.push({
        id: financial.id,
        type: 'decision',
        position: {
          x: col * LANE_WIDTH + LANE_PADDING_X,
          y: row * NODE_HEIGHT_GAP + LANE_PADDING_Y,
        },
        selectable: !isExtinguished,
        draggable: !isExtinguished,
        data: {
          financial,
          isActive,
          isSelected: !isExtinguished && selectedNodeId === financial.id,
          isExtinguished,
        },
        style: {
          opacity: isExtinguished
            ? 0.1
            : activePathNodeIds.has(financial.id)
              ? 1
              : 0.25,
        },
      })
    })
  }

  const nodeIds = new Set(treeData.nodes.map((n) => n.id))
  const edges: Edge[] = []

  for (const node of treeData.nodes) {
    for (const childId of node.childrenIds) {
      if (!nodeIds.has(childId)) continue
      const edgeExtinguished =
        extinguishedNodeIds.has(node.id) ||
        extinguishedNodeIds.has(childId)
      const onPath =
        !edgeExtinguished &&
        activePathNodeIds.has(node.id) &&
        activePathNodeIds.has(childId)

      edges.push({
        id: `${node.id}->${childId}`,
        source: node.id,
        target: childId,
        animated: onPath,
        interactionWidth: edgeExtinguished ? 0 : 20,
        style: {
          stroke: edgeExtinguished
            ? '#64748b'
            : onPath
              ? '#10b981'
              : '#334155',
          strokeWidth: onPath ? 2.5 : 1.5,
          opacity: edgeExtinguished ? 0.1 : onPath ? 1 : 0.25,
          strokeDasharray: edgeExtinguished ? '4 4' : undefined,
        },
      })
    }
  }

  return { nodes: flowNodes, edges }
}
