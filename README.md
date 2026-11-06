# Wumpus World

### Intelligent Agent & Environment Simulator

Browser-based **Wumpus World** laboratory: a classic hidden cave, **manual** play, and a **knowledge-based AI** whose beliefs and reasons stay visible. The app is static vanilla JavaScript (ES modules). There is no build step and no runtime npm dependency.

The publishable site lives in **`docs/`** so GitHub Pages can serve it as-is.

---

## Features

- Grid sizes **4×4 … 10×10** and a pit-density slider
- **New Game** generates a random solvable map; **Reset** restarts that same map from `(0,0)`
- **Manual mode**: move with on-screen buttons or arrow keys; shoot, grab, climb
- **AI mode**: Play / Pause / Resume / Next Step; speeds **250–2000 ms** (default **500 ms**)
- Separate **environment grid** (fog of war) and **agent knowledge map**
- Rule-based **inference** (pits and Wumpus tracked independently)
- **BFS** on known-safe cells; gold → return home → climb
- Scoring, statistics, reasoning log, local **game history**
- Result popups: **Victory** (green), **Defeat** (red), **Stuck** (yellow)
- Optional **debug reveal** (UI only — the AI never sees the hidden world)

There is **no seed / RNG seed UI**. Every New Game is a fresh random map.

---

## Wumpus World rules

- One Wumpus, one gold, many pits; start at **(0,0)** facing **East**
- Orthogonal neighbors only (4-direction). Percepts: **Breeze**, **Stench**, **Glitter**, **Scream**, **Bump**
- A pit produces a breeze in the four adjacent cells; the Wumpus produces a stench the same way
- Win: collect gold, return to start, climb out
- Lose: step into a pit or a living Wumpus
- Stuck: the agent has gold-climb as the only exit rule, and no remaining safe or risk move

---

## How the AI decides

The agent never reads the hidden map. It only uses its position, current percepts, and the knowledge base.

1. **Grab** gold on glitter.
2. **Climb** at `(0,0)` if gold is already held; otherwise walk home on a known-safe path.
3. Step into an **adjacent known-safe unvisited** cell.
4. **BFS** through known-safe cells to a farther safe unvisited cell.
5. **Shoot** a confirmed Wumpus, or a small (≤2) possible-Wumpus set, from a safe square on the same row/column.
6. If nothing safe remains, take the **lowest-risk unknown frontier** that still has a safe approach path. This can die — that is Defeat, not a bug.
7. **Stuck** only when no safe target and no risk frontier remain.

Inference confirms a pit only when a breeze has a **single remaining candidate**. Two breezes sharing a cell does **not** force that cell to be a pit. A scream clears every Wumpus flag so the corpse square is enterable.

---

## Project structure

```
docs/                     GitHub Pages root (the whole app)
  index.html
  favicon.svg
  css/style.css
  js/                     UI + game loop (DOM)
    main.js
    gameController.js
    uiController.js
  algorithm/              Pure game / AI logic (no DOM)
    shared.js             Constants, coordinates, shuffle
    worldGenerator.js     Random solvable maps
    worldEngine.js        Hidden world, actions, scoring
    perceptEngine.js      Breeze / stench / glitter / scream / bump
    knowledgeBase.js      Agent beliefs
    knowledgeConsistency.js  Pit candidate checks
    inferenceEngine.js    Logical updates
    pathFinder.js         Safe BFS + risk frontiers + plan-shot
    decisionEngine.js     Action choice (AIMA hybrid order)
    decisionDiagnostics.js  Stuck / debug snapshots
    aiAgent.js            OBSERVE → UPDATE → INFER → DECIDE → EXECUTE
tests/
  simulator.test.js       Node tests (imports docs/algorithm/)
package.json              `npm test` only
LICENSE                   MIT
.gitignore
README.md
```

**Separation:** `docs/algorithm/` never touches the DOM. `docs/js/` never decides moves. Tests import algorithm modules (and `GameController`) directly.

---

## Local setup

Serve **`docs/`** over HTTP. ES modules do not load from `file://`.

```powershell
cd docs
python -m http.server 8080
```

Open `http://localhost:8080/`.

Alternatives: VS Code Live Server with `docs/` as the root, or `npx serve docs`.

---

## Testing

Requires **Node.js 18+** (built-in test runner; no extra packages):

```powershell
npm test
```

---

## Scoring

| Event | Points |
|-------|--------|
| Each action | −1 |
| Gold | +1000 |
| Arrow | −10 |
| Exit with gold | +1000 |
| Death | −1000 |

---

## Limitations

- Pit reasoning is sole-candidate / unit-propagation, not a full SAT solver. Some cells stay “possible” until more evidence.
- Risk moves at high pit density can die. That is Defeat.
- History stores up to **50** games in `localStorage`.
- Very high pit density may fall back to a guaranteed-path generator (noted under Configuration).
