# FinTree AI

FinTree AI is a **multi-asset research repository** for exploring strategic scenarios on a chronological timeline. Paste structured JSON for any ticker (CRCL.N, NVDA, AAPL, …), switch assets in the header, merge or overwrite models through the UI — no code changes required.

A sample Circle (CRCL.N) JSON payload is pre-filled in the left terminal so you can initialize your first tracker immediately.

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

| Panel | Purpose |
|-------|---------|
| **Header — Ticker Hub** | Dropdown to switch assets; live base price + last updated; remove asset |
| **Left — Ingestion Router** | Paste JSON; auto-detect symbol; init / merge / overwrite |
| **Center — Decision Canvas** | Timeline lanes + strategy nodes |
| **Right — Valuation Analyzer** | Target price, return %, gauges for the active leaf |

On first boot with an empty repository, the canvas shows a landing prompt until you route your first JSON profile.

---

## How to use the app

1. **Route JSON** — Paste a full analyst profile and click **Route JSON (Auto Detect)**.
   - **New symbol** → creates a repository slot, switches to it (pristine / 全亮), shows a success toast.
   - **Existing symbol** → choose **Smart Incremental Merge** or **Complete Overwrite / Reset**.
2. **Switch assets** — Use the header dropdown.
3. **Explore a path** — Click any live node. Active path highlights; inactive branches fade.
4. **Lock a fact** — Double-click a node. Sibling branches are **soft-extinguished** (opacity 0.1, non-clickable, “EXTINGUISHED BY FACT LOCK” badge) — not hard-deleted.
5. **Unlock** — Double-click again to clear the fact and revive extinguished siblings.
6. **Merge into active** — Optional shortcut for patches targeted at the current ticker.

---

## How to feed data

**Ready-made examples for analysts** live in [`examples/`](./examples/):

| File | Purpose |
|------|---------|
| [`examples/blank-profile.template.json`](./examples/blank-profile.template.json) | Blank scaffold for a new ticker |
| [`examples/crcl-n.full-profile.json`](./examples/crcl-n.full-profile.json) | Complete working CRCL.N profile |
| [`examples/merge-patch.example.json`](./examples/merge-patch.example.json) | Incremental merge patch sample |
| [`examples/README.md`](./examples/README.md) | Field checklist and schema notes |

All input is **JSON** in the left terminal. Full initialize / overwrite payloads need:

```json
{
  "stockSymbol": "NVDA",
  "basePrice": 120.5,
  "lastUpdated": "2026-07-19",
  "timelineLanes": ["2026 H2", "2027", "2028-2029", "2031"],
  "nodes": [ /* … */ ]
}
```

| Field | Notes |
|-------|--------|
| `stockSymbol` | Repository key — must be unique per asset |
| `basePrice` | Reference price for return % |
| `timelineLanes` | Ordered time columns |
| `nodes` | Graph nodes; `lane` must match a timeline lane |
| `childrenIds` | Links; every child ID must exist in `nodes` |
| Leaf fields | `targetPrice`, `cagr`, etc. drive the right panel |

**Merge patches** need at least `nodes` (and usually `stockSymbol` when routing). Locked facts resist content overwrite.

---

## Soft-extinguish (fact lock)

Locking a node marks sibling subtrees as extinguished **without removing them** from the graph. History stays on the canvas as faded death paths. Unlocking revives those siblings.

---

## Stack (for developers)

- React 19 + TypeScript + Vite  
- Zustand multi-asset store (`stocks[activeSymbol]`)  
- `@xyflow/react` canvas  
- Tailwind CSS 4  
