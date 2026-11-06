import { cellKey, lineFacing, neighbors } from './shared.js';
import { minPitSupport } from './knowledgeConsistency.js';

export class PathFinder {
  static reconstruct(parent, end) {
    const path = [end];
    let k = cellKey(end.x, end.y);
    while (parent.has(k)) {
      const p = parent.get(k);
      path.unshift(p);
      k = cellKey(p.x, p.y);
    }
    return path;
  }

  /** Shortest path using only known-safe cells (visited safe + unvisited safe). */
  static path(kb, start, goal) {
    if (start.x === goal.x && start.y === goal.y) return [start];
    const q = [{ ...start }];
    const seen = new Set([cellKey(start.x, start.y)]);
    const parent = new Map();
    while (q.length) {
      const cur = q.shift();
      if (cur.x === goal.x && cur.y === goal.y) {
        return PathFinder.reconstruct(parent, cur);
      }
      for (const n of neighbors(cur.x, cur.y, kb.size)) {
        const k = cellKey(n.x, n.y);
        if (seen.has(k) || !kb.isSafe(n.x, n.y)) continue;
        seen.add(k);
        parent.set(k, cur);
        q.push(n);
      }
    }
    return null;
  }

  /** BFS from start through known-safe cells; returns path to nearest unvisited safe cell. */
  static nearestSafeUnvisited(kb, start) {
    if (!kb.isSafe(start.x, start.y) && !kb.get(start.x, start.y).visited) return null;
    const q = [{ ...start }];
    const seen = new Set([cellKey(start.x, start.y)]);
    const parent = new Map();
    while (q.length) {
      const cur = q.shift();
      for (const n of neighbors(cur.x, cur.y, kb.size)) {
        const k = cellKey(n.x, n.y);
        if (seen.has(k) || !kb.isSafe(n.x, n.y)) continue;
        seen.add(k);
        parent.set(k, cur);
        q.push(n);
        if (!kb.get(n.x, n.y).visited) {
          return PathFinder.reconstruct(parent, n);
        }
      }
    }
    return null;
  }

  static reachableSafeKeys(kb, start) {
    const keys = new Set();
    if (!kb.get(start.x, start.y).visited && !kb.isSafe(start.x, start.y)) return keys;
    const q = [{ ...start }];
    keys.add(cellKey(start.x, start.y));
    while (q.length) {
      const cur = q.shift();
      for (const n of neighbors(cur.x, cur.y, kb.size)) {
        const k = cellKey(n.x, n.y);
        if (keys.has(k) || !kb.isSafe(n.x, n.y)) continue;
        keys.add(k);
        q.push(n);
      }
    }
    return keys;
  }

  /** Unknown cells adjacent to any reachable known-safe cell. */
  static unknownFrontiers(kb, reachableSafeKeys) {
    const seen = new Set();
    const out = [];
    for (const key of reachableSafeKeys) {
      const [x, y] = key.split(',').map(Number);
      for (const n of neighbors(x, y, kb.size)) {
        const k = cellKey(n.x, n.y);
        if (seen.has(k)) continue;
        const c = kb.get(n.x, n.y);
        if (c.visited || kb.isDanger(n.x, n.y) || kb.isSafe(n.x, n.y)) continue;
        seen.add(k);
        out.push({ x: n.x, y: n.y, fromSafe: { x, y } });
      }
    }
    return out;
  }

  static riskScore(kb, x, y) {
    const c = kb.get(x, y);
    let r = 0;
    const support = minPitSupport(kb, x, y);
    if (c.possiblePit) {
      r += support ? Math.round(12 / support) : 4;
    } else if (!c.pitSafe) {
      r += 2;
    }
    if (c.possibleWumpus) r += 8;
    else if (!c.wumpusSafe) r += 2;
    return r;
  }

  /**
   * Lowest-risk unknown frontier reachable from start via known-safe cells.
   * Returns { frontier, approachPath, risk } where approachPath ends on safe cell next to frontier.
   */
  static bestRiskFrontier(kb, start) {
    const region = PathFinder.reachableSafeKeys(kb, start);
    const frontiers = PathFinder.unknownFrontiers(kb, region);
    if (!frontiers.length) return null;

    const ranked = frontiers
      .map((f) => ({ ...f, risk: PathFinder.riskScore(kb, f.x, f.y) }))
      .sort((a, b) => a.risk - b.risk || a.y - b.y || a.x - b.x);

    for (const f of ranked) {
      const approach = PathFinder.path(kb, start, f.fromSafe);
      if (approach && approach.length >= 1) {
        return { frontier: { x: f.x, y: f.y }, approachPath: approach, risk: f.risk };
      }
    }
    return null;
  }

  /**
   * Reach a known-safe square that shares a row/column with a target, then face it.
   * Arrow is never blocked by pits — only walls.
   */
  static planShot(kb, start, targets) {
    if (!targets.length) return null;
    const region = PathFinder.reachableSafeKeys(kb, start);
    let best = null;
    for (const t of targets) {
      for (const key of region) {
        const [sx, sy] = key.split(',').map(Number);
        if (sx === t.x && sy === t.y) continue;
        const facing = lineFacing({ x: sx, y: sy }, t);
        if (facing == null) continue;
        const approach = PathFinder.path(kb, start, { x: sx, y: sy });
        if (!approach) continue;
        const cost = approach.length + (t.confirmed ? 0 : 2);
        if (!best || cost < best.cost) {
          best = {
            target: { x: t.x, y: t.y },
            shootFrom: { x: sx, y: sy },
            facing,
            approachPath: approach,
            cost,
            confirmed: Boolean(t.confirmed),
          };
        }
      }
    }
    return best;
  }
}
