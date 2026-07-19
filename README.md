# FinTree AI

FinTree AI helps you explore a company’s strategic scenarios on a timeline — like a decision tree for analysts. Paste structured JSON, click through paths, and instantly see projected valuation for the active outcome.

A sample **Circle (CRCL.N)** tree loads automatically so you can try the app right away.

---

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://127.0.0.1:5173`).

| Command | What it does |
|---------|----------------|
| `npm run dev` | Start the local app |
| `npm run build` | Create a production build |
| `npm run preview` | Preview the production build |

---

## What you’ll see

The screen has three areas:

| Panel | Purpose |
|-------|---------|
| **Left — Ingestion Terminal** | Paste JSON and load or update the tree |
| **Center — Decision Canvas** | Timeline lanes + strategy nodes you can click |
| **Right — Valuation Analyzer** | Target price, return %, and path gauges |

Active path nodes glow green. Inactive branches fade so you can focus on one scenario.

---

## How to use the app

1. **Explore a path** — Click any node. FinTree highlights the line from the root through your selection to a terminal outcome (leaf). If several leaves sit downstream, it prefers the one with the highest target price.
2. **Read the valuation** — The right panel updates with that leaf’s target price, return vs base price, CAGR, and related metrics.
3. **Lock a fact** — Double-click a node to mark it as historical fact. Sibling branches (and everything under them) are pruned so earlier history becomes a single pipeline.
4. **Unlock** — Double-click again to clear the lock flag. Pruned branches are not restored unless you merge them back in via JSON.
5. **Pan & zoom** — Drag the canvas; use controls or scroll to zoom. Timeline headers sit at the top of each period lane.

---

## How to feed data

All input is **JSON** in the left terminal.

### Two actions

| Button | When to use |
|--------|-------------|
| **Initialize Tree** | First load, or replace the whole tree. Needs a full payload (see below). |
| **Incremental Merge Update** | Add or update nodes without wiping what you already have. Locked facts are protected from overwrite. |

### Full tree shape (Initialize)

```json
{
  "stockSymbol": "CRCL.N (Circle Internet Group)",
  "basePrice": 65.69,
  "lastUpdated": "2026-07-19",
  "timelineLanes": ["2026 H2", "2027", "2028-2029", "2031"],
  "nodes": [ /* see node fields below */ ]
}
```

| Field | Required | Meaning |
|-------|----------|---------|
| `stockSymbol` | Yes (init) | Ticker / company label |
| `basePrice` | Yes (init) | Current or reference price |
| `lastUpdated` | Recommended | Date string shown in the UI |
| `timelineLanes` | Yes (init) | Ordered time bands (columns on the canvas) |
| `nodes` | Yes | All decision / outcome nodes |

### Node fields

```json
{
  "id": "path_a_share",
  "lane": "2027",
  "title": "Path A: Share economics",
  "description": "What this decision means…",
  "isLockedFact": false,
  "childrenIds": ["path_x_high_exec", "path_y_low_exec"],
  "financialImpact": {
    "cagrEffect": "+15%",
    "marginEffect": "-10%",
    "revenueEffect": "+$1.2B"
  }
}
```

| Field | Notes |
|-------|--------|
| `id` | Unique string. Used for linking and merges. |
| `lane` | Must match one entry in `timelineLanes`. |
| `childrenIds` | IDs of next-step nodes. Leaves use `[]`. |
| `isLockedFact` | `true` = treat as settled history (also set via double-click). |
| `financialImpact` | Optional badges on intermediate nodes. |
| `targetPrice`, `cagr`, `netReserveRevenue`, `cpnVolume` | Use on **leaf** (terminal) nodes for the right-panel scorecard. |

### Minimal leaf example

```json
{
  "id": "leaf_bull_case",
  "lane": "2031",
  "title": "Bull Case",
  "description": "Upside outcome",
  "isLockedFact": false,
  "targetPrice": 243.0,
  "cagr": "40%",
  "netReserveRevenue": "$5.6B",
  "cpnVolume": "$300B/year",
  "childrenIds": []
}
```

### Incremental merge (patch)

You do **not** need a full tree. Send at least a `nodes` array. Optional fields update metadata when present:

```json
{
  "basePrice": 70.12,
  "lastUpdated": "2026-08-01",
  "timelineLanes": ["2032"],
  "nodes": [
    {
      "id": "leaf_new_case",
      "lane": "2032",
      "title": "New Scenario",
      "description": "Fresh analyst case",
      "isLockedFact": false,
      "targetPrice": 180,
      "cagr": "30%",
      "childrenIds": []
    }
  ]
}
```

**Merge rules (short version):**

- New `id` → node is appended.
- Existing `id` → fields are deep-merged, unless that node is locked.
- Locked nodes keep their core content; new child links can still be grafted carefully.
- Parent `childrenIds` are kept unique; broken references show an error in the terminal.

### Tips for good data

1. Put every `lane` value in `timelineLanes` (same spelling).
2. Connect the graph with `childrenIds` — every child ID must exist in `nodes`.
3. Give leaves a `targetPrice` so the valuation panel can compute return %.
4. Keep IDs stable across updates so merges attach to the right nodes.
5. If JSON is invalid, the red error banner under the textarea explains the problem.

---

## Built-in sample

On startup, FinTree loads the mock tree in `src/data/mockTree.ts` (Circle / OUSD scenario). The same JSON is pre-filled in the left terminal so you can edit it, re-initialize, or practice merges.

---

## Stack (for developers)

- React 19 + TypeScript + Vite  
- Zustand (path selection, merge, fact pruning)  
- `@xyflow/react` canvas  
- Tailwind CSS 4  
