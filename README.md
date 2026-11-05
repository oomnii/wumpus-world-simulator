# Wumpus World
### Intelligent Agent & Environment Simulator

Browser-based **Artificial Intelligence laboratory** project: a partially observable grid world, a rule-based agent with explicit inference, and a dashboard for manual play or step-by-step AI demonstration.

---

## 1. Project Overview

You control (or observe) an agent in a cave grid containing **pits**, one **Wumpus**, and one **gold** pile. The agent learns only from **percepts** at its current cell. The goal is to **collect gold**, **return to (0,0)**, and **climb out** alive.

The simulator separates:

- **Hidden world** — true positions of hazards and gold (world engine only).
- **Agent knowledge** — visited cells, safe/danger beliefs, and inferred constraints (AI and manual inference map).

---

## 2. Project Objectives

- Model a classic **Wumpus World** environment (4×4 … 10×10).
- Implement **knowledge-based** reasoning (not random movement).
- Visualize **percepts**, **inference**, and **decisions** for teaching.
- Support **manual** and **autonomous AI** modes on the same world.
- Provide reproducible worlds (**seed**), scoring, and **local game history**.

---

## 3. Features

- Configurable grid size, pit density, optional seed, New Game / Reset
- Manual controls + keyboard (arrows, Space, S, Enter)
- AI: Play, Pause, Resume, Next Step, speed (default **500 ms** per action)
- Environment grid with fog-of-war (`?` until visited)
- Agent knowledge map (safe / possible / confirmed danger / visited)
- Live percepts, statistics, reasoning log, end-of-game summary
- Optional **debug reveal** of hidden world (UI only — not passed to AI)
- Vitest unit tests; static production build (Vite)

---

## 4. Technology Stack

| Layer | Choice |
|--------|--------|
| UI | HTML5, CSS3, ES modules |
| Build | [Vite](https://vite.dev/) 8 |
| Tests | [Vitest](https://vitest.dev/) 4 |
| Runtime | Browser only (no backend, no API keys) |
| Persistence | `localStorage` (game history) |

---

## 5. AI Concepts Demonstrated

- Partially observable environment  
- Percept → belief update → inference → action  
- Separate **possible** vs **confirmed** hazards  
- Single-agent planning with **BFS** over known-safe cells  
- Risk-aware fallback when no safe frontier exists  

---

## 6. Wumpus World Rules

- Orthogonal moves only (no diagonals).
- One Wumpus, one gold, multiple pits.
- Start at **(0,0)**; start area is kept hazard-free adjacent to start.
- One arrow; shooting is along a row/column until wall or Wumpus hit.
- Win: gold collected, return to start, climb out.
- Lose: pit or live Wumpus on entry.

---

## 7. Percepts

| Percept | Meaning |
|---------|---------|
| **Breeze** | Pit in an adjacent cell |
| **Stench** | Living Wumpus adjacent |
| **Glitter** | Gold in current cell |
| **Scream** | Arrow killed the Wumpus |
| **Bump** | Move blocked by grid edge |

---

## 8. AI Agent Architecture

```
Observe percepts → Update knowledge → Infer → Decide → Execute one action
                         ↑                    │
                         └── PathFinder (BFS on safe cells)
```

Modules: `KnowledgeBase`, `InferenceEngine`, `PathFinder`, `DecisionEngine`, `AIAgent`.

---

## 9. Knowledge Base and Inference

Per cell the agent tracks visit status, pit/Wumpus safety flags, possible/confirmed hazards, and gold discovery.

- **No Breeze** → adjacent cells marked pit-safe (for that observation).  
- **Breeze** → at least one adjacent pit possible; single unresolved neighbor → pit confirmed.  
- **No Stench** → adjacent Wumpus-safe.  
- **Stench** → intersect Wumpus candidates (single Wumpus in world).  
- **Scream** → Wumpus dead; clear Stench reasoning.  
- **Safe** → both pit and living-Wumpus ruled out (or survived visit).

---

## 10. Pathfinding and Decision Making

1. Grab gold if Glitter.  
2. If gold held, BFS home to (0,0), then climb.  
3. Explore adjacent **known-safe** unvisited cells.  
4. BFS to nearest safe unvisited cell.  
5. Lowest-risk unknown cell (logged as risk-based).  
6. Shoot only when Wumpus is **confirmed** and aligned; else stuck if no move.

---

## 11. Manual Mode vs AI Mode

| | Manual | AI |
|---|--------|-----|
| Movement | You | Decision engine |
| Inference map | Yes | Yes |
| Reasoning log | Percepts + inference | Full cycle + stage label |
| World on mode switch | Unchanged | Unchanged |

---

## 12. World Configuration

- **Grid:** 4×4 … 10×10 (default 10×10)  
- **Pit density:** slider (approximate pit count)  
- **Seed:** optional deterministic generation  
- **Debug reveal:** show true map (demonstrations only)

Worlds are checked for solvability (path to gold and back); repeated failure uses a constrained fallback generator (note shown in UI).

---

## 13. Scoring System

| Event | Points |
|-------|--------|
| Each action | −1 |
| Collect gold | +1000 |
| Shoot arrow | −10 |
| Climb out with gold | +1000 |
| Death | −1000 |

---

## 14. Project Structure

```
index.html
vite.config.js
package.json
public/favicon.svg
src/
  main.js                 App bootstrap
  engine/                 World generation, rules, percepts, scoring
  agent/                  Knowledge, inference, BFS, decisions, AI cycle
  controllers/            Game loop, animation timer, keyboard
  components/             Dashboard UI renderers
  utils/                  Constants, coordinates, seeded RNG
  styles/                 Global, layout, components, game, responsive
  tests/                  Vitest suites
.github/workflows/        Optional GitHub Pages deploy
```

---

## 15. Installation

```bash
git clone <your-repo-url>
cd wumpus-world
npm install
```

Requires **Node.js 18+**.

---

## 16. Running Locally

```bash
npm run dev
```

Open the URL printed in the terminal (typically `http://localhost:5173`).

---

## 17. Production Build

```bash
npm run build
npm run preview
```

Output directory: **`dist/`** (not committed; listed in `.gitignore`).

For a **local root** deploy, default `base` is `/`.

---

## 18. Testing

```bash
npm test
```

Covers world generation, percepts, inference, pathfinding, engine rules, and agent/controller behavior.

---

## 19. GitHub Deployment

This is a **static SPA** (single `index.html` entry, no client-side router).

### Option A — GitHub Pages (included workflow)

1. Push the repo to GitHub.  
2. **Settings → Pages → Build and deployment → Source:** GitHub Actions.  
3. Push to `main` (or `master`); workflow **Deploy to GitHub Pages** runs tests, builds with  
   `VITE_BASE=/<repository-name>/`, and deploys `dist/`.  
4. Site URL: `https://<user>.github.io/<repository-name>/`

### Option B — Manual build (upload `dist/` yourself)

```bash
# Windows CMD (replace with your GitHub repo name):
set VITE_BASE=/your-repo-name/
npm run build
```

```powershell
# Windows PowerShell:
$env:VITE_BASE="/your-repo-name/"
npm run build
```

Upload the contents of **`dist/`** only if you deploy without GitHub Actions. For the included workflow, push source code and let Actions build — do **not** commit `dist/`.

No environment variables are required for local dev or a root-hosted build.

**Secret audit:** No `.env`, API keys, or credentials are used by this project.

---

## 20. Usage Instructions

1. Set grid size and pit density; optional seed.  
2. **Generate / New Game**.  
3. **AI Agent:** **Play** (pause / resume / next step as needed).  
4. **Manual:** switch mode; use buttons or keyboard.  
5. Watch **Reasoning Log** and **Knowledge Map**.  
6. Use **Help** in the header for rules and the AI cycle.  
7. **View All** / **Clear History** for past runs (confirm before clear).

---

## 21. Limitations and Assumptions

- Pit constraints are local/heuristic, not full CSP; some pits stay “possible” until more evidence.  
- Risk-based moves can still fail; they are labeled in the log.  
- History keeps the latest **50** games in `localStorage`.  
- High pit density may trigger the fallback world generator.

---

## 22. License

No license file is included in this repository. Treat as academic coursework unless you add a `LICENSE` file.
