import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Lock } from 'lucide-react'
import type { DecisionNodeData } from '../../utils/treeLayout'
import { StatusBadge, inferImpactTone } from '../Shared/StatusBadge'
import { useTreeStore } from '../../store/useTreeStore'
import clsx from 'clsx'

function CustomDecisionNodeComponent({
  data,
  id,
}: NodeProps<Node<DecisionNodeData>>) {
  const selectNode = useTreeStore((s) => s.selectNode)
  const toggleLockFact = useTreeStore((s) => s.toggleLockFact)
  const { financial, isActive, isSelected } = data
  const impact = financial.financialImpact
  const isLeaf = financial.childrenIds.length === 0 && financial.targetPrice != null

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        selectNode(id)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        toggleLockFact(id)
      }}
      className={clsx(
        'w-[260px] cursor-pointer rounded-xl border bg-slate-900/80 p-4 shadow-lg backdrop-blur-sm transition-all duration-300',
        isActive
          ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
          : 'border-slate-800',
        isSelected && 'ring-2 ring-emerald-400/40',
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-slate-600 !bg-slate-400"
      />

      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug text-slate-100">
          {financial.title}
        </h3>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {financial.isLockedFact && (
            <StatusBadge
              label="FACT"
              tone="locked"
              icon={<Lock className="h-2.5 w-2.5" />}
            />
          )}
        </div>
      </div>

      <p className="mb-3 line-clamp-3 text-[11px] leading-relaxed text-slate-400">
        {financial.description}
      </p>

      <div className="flex flex-wrap gap-1">
        {impact?.cagrEffect && (
          <StatusBadge
            label={`CAGR ${impact.cagrEffect}`}
            tone={inferImpactTone(impact.cagrEffect)}
          />
        )}
        {impact?.marginEffect && (
          <StatusBadge
            label={`Mgn ${impact.marginEffect}`}
            tone={inferImpactTone(impact.marginEffect)}
          />
        )}
        {impact?.revenueEffect && (
          <StatusBadge
            label={impact.revenueEffect}
            tone={inferImpactTone(impact.revenueEffect)}
          />
        )}
        {isLeaf && (
          <StatusBadge
            label={`$${financial.targetPrice!.toFixed(2)}`}
            tone={
              financial.targetPrice! >= 200
                ? 'positive'
                : financial.targetPrice! < 80
                  ? 'negative'
                  : 'info'
            }
          />
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-slate-600 !bg-slate-400"
      />
    </div>
  )
}

export const CustomDecisionNode = memo(CustomDecisionNodeComponent)
