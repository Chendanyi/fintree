import { useEffect, useMemo, useCallback, type MouseEvent } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  BackgroundVariant,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useTreeStore } from '../../store/useTreeStore'
import { layoutTreeToFlow, type DecisionNodeData } from '../../utils/treeLayout'
import { CustomDecisionNode } from './CustomDecisionNode'
import { TimelineSwimlanes } from './TimelineSwimlanes'

const nodeTypes = { decision: CustomDecisionNode }

export function DecisionCanvas() {
  const treeData = useTreeStore((s) => s.treeData)
  const activePathNodeIds = useTreeStore((s) => s.activePathNodeIds)
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId)
  const selectNode = useTreeStore((s) => s.selectNode)

  const layout = useMemo(() => {
    if (!treeData) return { nodes: [], edges: [] }
    return layoutTreeToFlow(treeData, activePathNodeIds, selectedNodeId)
  }, [treeData, activePathNodeIds, selectedNodeId])

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges)

  useEffect(() => {
    setNodes(layout.nodes)
    setEdges(layout.edges)
  }, [layout, setNodes, setEdges])

  const onNodeClick = useCallback(
    (_: MouseEvent, node: Node) => {
      selectNode(node.id)
    },
    [selectNode],
  )

  if (!treeData) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950">
        <div className="text-center">
          <p className="font-mono text-sm text-slate-500">
            AWAITING TREE INGESTION
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Paste JSON in the left terminal and initialize
          </p>
        </div>
      </div>
    )
  }

  const canvasHeight = Math.max(720, treeData.nodes.length * 140 + 240)

  return (
    <div className="relative h-full w-full bg-slate-950">
      <ReactFlow
        nodes={nodes as Node<DecisionNodeData>[]}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.35}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        className="bg-slate-950"
      >
        <TimelineSwimlanes
          lanes={treeData.timelineLanes}
          height={canvasHeight}
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#1e293b"
        />
        <Controls className="!border-slate-700 !bg-slate-900 !shadow-xl" />
        <MiniMap
          nodeColor={(n) =>
            activePathNodeIds.has(n.id) ? '#10b981' : '#334155'
          }
          maskColor="rgba(2,6,23,0.75)"
          className="!border-slate-700 !bg-slate-900/90"
        />
      </ReactFlow>
    </div>
  )
}
