import { ViewportPortal } from '@xyflow/react'
import { LANE_WIDTH, LANE_PADDING_X } from '../../utils/treeLayout'

interface TimelineSwimlanesProps {
  lanes: string[]
  height: number
}

/** Chronological lane columns rendered in React Flow viewport space. */
export function TimelineSwimlanes({ lanes, height }: TimelineSwimlanesProps) {
  return (
    <ViewportPortal>
      <div
        className="pointer-events-none absolute top-0 left-0 z-0"
        style={{
          width: lanes.length * LANE_WIDTH + LANE_PADDING_X * 2,
          height,
        }}
      >
        {/* Header labels */}
        <div className="flex" style={{ marginLeft: LANE_PADDING_X }}>
          {lanes.map((lane) => (
            <div
              key={`header-${lane}`}
              className="flex items-center justify-center border-b border-r border-slate-800/70 py-3"
              style={{ width: LANE_WIDTH }}
            >
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {lane}
              </span>
            </div>
          ))}
        </div>

        {/* Vertical lane columns */}
        <div className="relative flex" style={{ height: height - 48, marginLeft: LANE_PADDING_X }}>
          {lanes.map((lane, i) => (
            <div
              key={`lane-${lane}`}
              className="relative border-r border-slate-800/40"
              style={{
                width: LANE_WIDTH,
                background:
                  i % 2 === 0
                    ? 'linear-gradient(180deg, rgba(30,41,59,0.45) 0%, rgba(15,23,42,0.08) 100%)'
                    : 'linear-gradient(180deg, rgba(15,23,42,0.25) 0%, transparent 100%)',
              }}
            >
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-slate-600/25 via-slate-800/10 to-transparent" />
            </div>
          ))}
        </div>
      </div>
    </ViewportPortal>
  )
}
