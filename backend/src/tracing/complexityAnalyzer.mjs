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

    if (maxDepth === 0) {
    return {
        available: true,
        bigO: "O(1)",
        explanation: "No loops detected."
    };
}

if (maxDepth === 1) {
    return {
        available: true,
        bigO: "O(n)",
        explanation: "One loop detected."
    };
}

return {
    available: true,
    bigO: `O(n^${maxDepth})`,
    explanation: `${maxDepth} nested loops detected.`
};

  } catch (error) {
    return {
        available: false,
        bigO: null,
        explanation: "Unable to analyze complexity due to syntax errors."
    };
}
}