# FinTree AI

Production-grade dark-themed React app for visualizing corporate strategic paths over a chronological timeline.

## Stack

- React 19 + TypeScript + Vite
- Zustand (active path, incremental merge, fact pruning)
- `@xyflow/react` decision canvas
- Tailwind CSS 4

## Scripts

```bash
npm install
npm run dev
npm run build
```

## Interaction

- **Click** a node → select active path (ancestor + heaviest leaf)
- **Double-click** a node → lock as historical fact and prune sibling branches
- Left panel → initialize or incrementally merge JSON tree patches
- Right panel → live target price / return / CAGR gauges for the active leaf
