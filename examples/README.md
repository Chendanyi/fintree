# FinTree JSON examples (for analysts)

Use these files as the contract when creating or updating strategic trees. Paste the full file into the left **Ingestion Router**, or start from the blank template.

| File | Use when |
|------|----------|
| [`blank-profile.template.json`](./blank-profile.template.json) | Starting a **new** ticker — replace `TICKER`, prices, lanes, and nodes |
| [`crcl-n.full-profile.json`](./crcl-n.full-profile.json) | Complete working **full profile** (Circle / CRCL.N) |
| [`merge-patch.example.json`](./merge-patch.example.json) | **Incremental merge** into an existing asset (update + append nodes) |

## Required top-level fields (full profile)

| Field | Type | Required |
|-------|------|----------|
| `stockSymbol` | string | Yes — repository key (e.g. `"NVDA"`) |
| `basePrice` | number | Yes — reference price for return % |
| `lastUpdated` | string | Recommended — e.g. `"2026-07-19"` |
| `timelineLanes` | string[] | Yes — ordered time columns |
| `nodes` | object[] | Yes — decision / outcome graph |

## Node fields

| Field | Type | Notes |
|-------|------|--------|
| `id` | string | Unique; stable across merges |
| `lane` | string | Must match an entry in `timelineLanes` |
| `title` | string | Card headline |
| `description` | string | Card body |
| `isLockedFact` | boolean | Historical fact flag |
| `childrenIds` | string[] | Next-step node IDs; `[]` for leaves |
| `financialImpact` | object | Optional: `cagrEffect`, `marginEffect`, `revenueEffect` |
| `targetPrice` | number | Leaf only — drives valuation panel |
| `cagr` | string | Leaf optional |
| `netReserveRevenue` | string | Leaf optional |
| `cpnVolume` | string | Leaf optional |

## Checklist before pasting

1. Every `childrenIds` value exists as some node `id`.
2. Every node `lane` appears in `timelineLanes` (same spelling).
3. At least one leaf has `targetPrice` if you want return % on the right panel.
4. For a **new** asset, change `stockSymbol` so it does not collide with an existing ticker (unless you intend merge/overwrite).

## How to load in the app

1. Open the JSON file → copy all.
2. Paste into the left terminal.
3. Click **Route JSON (Auto Detect)**.
4. New symbol → initializes; existing symbol → choose Smart Merge or Overwrite.
