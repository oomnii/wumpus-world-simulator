import { cellKey, neighbors } from '../utils/coordinates.js';

export class PathFinder {
  static bfsSafePath(kb, start, goal) {
    if (start.x === goal.x && start.y === goal.y) return [start];

    const queue = [{ ...start }];
    const visited = new Set([cellKey(start.x, start.y)]);
    const parent = new Map();

    while (queue.length) {
      const cur = queue.shift();
      if (cur.x === goal.x && cur.y === goal.y) {
        const path = [cur];
        let k = cellKey(cur.x, cur.y);
        while (parent.has(k)) {
          const prev = parent.get(k);
          path.unshift(prev);
          k = cellKey(prev.x, prev.y);
        }
        return path;
      }

      for (const n of neighbors(cur.x, cur.y, kb.size)) {
        const key = cellKey(n.x, n.y);
        if (visited.has(key)) continue;
        if (!kb.isDefinitelySafe(n.x, n.y)) continue;
        visited.add(key);
        parent.set(key, cur);
        queue.push({ x: n.x, y: n.y });
      }
    }

    return null;
  }

  static nearestSafeUnvisited(kb, start) {
    const targets = kb.getSafeUnvisited();
    if (!targets.length) return null;

    let best = null;
    let bestPath = null;
    for (const t of targets) {
      const path = PathFinder.bfsSafePath(kb, start, t);
      if (!path) continue;
      if (!bestPath || path.length < bestPath.length) {
        bestPath = path;
        best = t;
      } else if (bestPath && path.length === bestPath.length) {
        const tie = t.y < best.y || (t.y === best.y && t.x < best.x);
        if (tie) {
          bestPath = path;
          best = t;
        }
      }
    }
    return bestPath;
  }
}
