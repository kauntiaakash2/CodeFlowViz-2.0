const graph = {
  A: ["B", "C"],
  B: ["D"],
  C: ["E"],
  D: [],
  E: []
};

function bfs(start) {
  const queue = [start];
  const visited = new Set([start]);

  while (queue.length) {
    const node = queue.shift();
    console.log(node);

    for (const neighbor of graph[node]) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
}

bfs("A");