import * as acorn from 'acorn';

export function estimateComplexity(code) {
  try {
    const ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script' });
    let maxDepth = 0;

    function walk(node, currentDepth) {
      if (!node) return;

      let nextDepth = currentDepth;
      
      // Check for loop structures
      const loopTypes = ['ForStatement', 'WhileStatement', 'DoWhileStatement', 'ForOfStatement', 'ForInStatement'];
      if (loopTypes.includes(node.type)) {
        nextDepth += 1;
        if (nextDepth > maxDepth) maxDepth = nextDepth;
      }

      // Recursively traverse child nodes
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) {
            node[key].forEach(child => walk(child, nextDepth));
          } else {
            walk(node[key], nextDepth);
          }
        }
      }
    }

    walk(ast, 0);

    if (maxDepth === 0) return "O(1)";
    if (maxDepth === 1) return "O(n)";
    return `O(n^${maxDepth})`;

  } catch (error) {
    return "Unknown"; // Failsafe if the code has syntax errors
  }
}