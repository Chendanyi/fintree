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
import { getActiveSnapshot } from '../../types/financialTree'
import { layoutTreeToFlow, type DecisionNodeData } from '../../utils/treeLayout'
import { CustomDecisionNode } from './CustomDecisionNode'
import { TimelineSwimlanes } from './TimelineSwimlanes'

const nodeTypes = { decision: CustomDecisionNode }

export function DecisionCanvas() {
  const repository = useTreeStore((s) => s.repository)
  const activeSymbol = useTreeStore((s) => s.activeSymbol)
  const selectNode = useTreeStore((s) => s.selectNode)

  const snapshot = getActiveSnapshot(repository, activeSymbol)
  const hasAnyAssets = Object.keys(repository).length > 0

  const activePathSet = useMemo(
    () => new Set(snapshot?.activePathNodeIds ?? []),
    [snapshot?.activePathNodeIds],
  )
  const extinguishedSet = useMemo(
    () => new Set(snapshot?.extinguishedNodeIds ?? []),
    [snapshot?.extinguishedNodeIds],
  )

  const layout = useMemo(() => {
    if (!snapshot) return { nodes: [], edges: [] }
    return layoutTreeToFlow(
      snapshot.treeData,
      activePathSet,
      snapshot.selectedNodeId,
      extinguishedSet,
    )
  }, [snapshot, activePathSet, extinguishedSet])

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges)

  useEffect(() => {
    setNodes(layout.nodes)
    setEdges(layout.edges)
  }, [layout, setNodes, setEdges])

  const onNodeClick = useCallback(
    (_: MouseEvent, node: Node) => {
      if (extinguishedSet.has(node.id)) return
      selectNode(node.id)
    },
    [selectNode, extinguishedSet],
  )

  if (!hasAnyAssets || !snapshot) {
    return (
      <div className="relative flex h-full items-center justify-center bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.9)_0%,rgba(2,6,23,1)_70%)]" />
        <div className="relative z-10 mx-6 max-w-lg rounded-2xl border border-slate-800 bg-slate-900/70 px-8 py-10 text-center backdrop-blur">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-500">
            FinTree AI Repository Sandbox
          </p>
          <h2 className="mt-3 text-lg font-semibold text-slate-100">
            Repository empty
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Ingest structured financial JSON to deploy your first simulation
            model. Each ticker keeps its own path, locks, and extinguished
            branches when you switch.
          </p>
        </div>
      </div>
    )
  }

  const canvasHeight = Math.max(
    720,
    snapshot.treeData.nodes.length * 140 + 240,
  )

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
          lanes={snapshot.treeData.timelineLanes}
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
          nodeColor={(n) => {
            if (extinguishedSet.has(n.id)) return '#475569'
            return activePathSet.has(n.id) ? '#10b981' : '#334155'
          }}
          maskColor="rgba(2,6,23,0.75)"
          className="!border-slate-700 !bg-slate-900/90"
        />
      </ReactFlow>
    </div>
  )
}
