/** Iterative Tarjan strongly connected components. Safe for deep graphs (no recursion). */
export function stronglyConnectedComponents(
  nodes: readonly string[],
  adj: ReadonlyMap<string, readonly string[]>,
): string[][] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const result: string[][] = [];
  let counter = 0;
  const lowOf = (v: string): number => low.get(v) ?? 0;
  const indexOf = (v: string): number => index.get(v) ?? 0;

  for (const root of nodes) {
    if (index.has(root)) continue;
    const work: { v: string; i: number }[] = [{ v: root, i: 0 }];
    index.set(root, counter);
    low.set(root, counter);
    counter++;
    stack.push(root);
    onStack.add(root);
    while (work.length > 0) {
      const frame = work[work.length - 1] as { v: string; i: number };
      const neighbors = adj.get(frame.v) ?? [];
      if (frame.i < neighbors.length) {
        const w = neighbors[frame.i] as string;
        frame.i++;
        if (!index.has(w)) {
          index.set(w, counter);
          low.set(w, counter);
          counter++;
          stack.push(w);
          onStack.add(w);
          work.push({ v: w, i: 0 });
        } else if (onStack.has(w)) {
          low.set(frame.v, Math.min(lowOf(frame.v), indexOf(w)));
        }
      } else {
        work.pop();
        const parentFrame = work[work.length - 1];
        if (parentFrame) low.set(parentFrame.v, Math.min(lowOf(parentFrame.v), lowOf(frame.v)));
        if (lowOf(frame.v) === indexOf(frame.v)) {
          const component: string[] = [];
          let w: string;
          do {
            w = stack.pop() as string;
            onStack.delete(w);
            component.push(w);
          } while (w !== frame.v);
          result.push(component);
        }
      }
    }
  }
  return result;
}

export function buildAdjacency(
  nodes: readonly string[],
  edges: readonly { from: string; to: string }[],
): Map<string, string[]> {
  const adj = new Map<string, string[]>(nodes.map((n) => [n, []]));
  for (const e of edges) adj.get(e.from)?.push(e.to);
  for (const list of adj.values()) list.sort();
  return adj;
}

/** Non-trivial components (size above 1), deterministically ordered. */
export function findCycles(
  nodes: readonly string[],
  edges: readonly { from: string; to: string }[],
): string[][] {
  const sortedNodes = [...nodes].sort();
  const comps = stronglyConnectedComponents(sortedNodes, buildAdjacency(sortedNodes, edges));
  return comps
    .filter((c) => c.length > 1)
    .map((c) => c.sort())
    .sort((a, b) => (a[0] as string).localeCompare(b[0] as string));
}
