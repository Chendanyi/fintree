import { describe, expect, it } from 'vitest'
import { detectCycle, mergeTreeData } from '../useTreeStore'
import {
  makeCrclTree,
  makeCyclicNodes,
  makeNode,
} from '../../test/fixtures'

describe('detectCycle', () => {
  it('returns true when nodes form a directed cycle (A to B to A)', () => {
    expect(detectCycle(makeCyclicNodes())).toBe(true)
  })

  it('returns false for a normal multi-lane hierarchical financial tree', () => {
    expect(detectCycle(makeCrclTree().nodes)).toBe(false)
  })

  it('handles orphaned and disconnected nodes without throwing', () => {
    const nodes = [
      makeNode({ id: 'root', lane: '2026', title: 'Root', childrenIds: ['missing_child'] }),
      makeNode({ id: 'orphan', lane: '2027', title: 'Orphan', childrenIds: [] }),
    ]
    expect(() => detectCycle(nodes)).not.toThrow()
    expect(detectCycle(nodes)).toBe(false)
  })
})

describe('mergeTreeData', () => {
  it('deep-merges topology while preserving isLockedFact on existing locked nodes', () => {
    const current = makeCrclTree()
    const lockedRoot = current.nodes.find((n) => n.id === 'node_root')!
    expect(lockedRoot.isLockedFact).toBe(true)

    const patch = {
      stockSymbol: current.stockSymbol,
      nodes: [
        makeNode({
          id: 'node_root',
          lane: '2026 H2',
          title: 'Updated root title should not unlock',
          description: 'Incoming speculative overwrite attempt',
          isLockedFact: false,
          childrenIds: ['path_a', 'path_b', 'path_c_new'],
        }),
        makeNode({
          id: 'path_c_new',
          lane: '2027',
          title: 'New branch',
          childrenIds: [],
        }),
      ],
    }

    const { data, error } = mergeTreeData(current, patch)
    expect(error).toBeNull()

    const mergedRoot = data.nodes.find((n) => n.id === 'node_root')!
    expect(mergedRoot.isLockedFact).toBe(true)
    expect(mergedRoot.title).toBe('Visa & Stripe OUSD Launch')
    expect(mergedRoot.childrenIds).toContain('path_c_new')
    expect(data.nodes.some((n) => n.id === 'path_c_new')).toBe(true)
  })

  it('updates unlocked node metrics while keeping isLockedFact false', () => {
    const current = makeCrclTree()
    const patch = {
      nodes: [
        makeNode({
          id: 'leaf_bull',
          lane: '2031',
          title: 'Bull Case revised',
          targetPrice: 260,
          cagr: '42%',
          isLockedFact: true,
          childrenIds: [],
        }),
      ],
    }

    const { data, error } = mergeTreeData(current, patch)
    expect(error).toBeNull()

    const leaf = data.nodes.find((n) => n.id === 'leaf_bull')!
    expect(leaf.targetPrice).toBe(260)
    expect(leaf.cagr).toBe('42%')
    expect(leaf.title).toBe('Bull Case revised')
    // Incoming cannot flip lock on via merge — preserve existing false
    expect(leaf.isLockedFact).toBe(false)
  })
})
