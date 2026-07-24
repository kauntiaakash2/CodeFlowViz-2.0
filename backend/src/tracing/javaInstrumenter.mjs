import Parser from 'tree-sitter';
import Java from 'tree-sitter-java';

const parser = new Parser();
parser.setLanguage(Java);

function insertAt(inserts, index, text, priority = 0) {
  inserts.push({ index, text, priority });
}

// Generates the injected Java trace hook
function traceCall(line, event) {
  return `\n_Trace.capture(${line}, "${event}");`;
}

function visitIterative(source, rootNode, inserts) {
  const stack = [rootNode];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;

    let traverseChildren = true;

    switch (node.type) {
      case 'local_variable_declaration':
      case 'assignment_expression':
      case 'update_expression': {
        const line = node.startPosition.row + 1;
        if (inserts.length < 1000) {
          insertAt(inserts, node.endIndex, traceCall(line, 'assignment'));
        }
        break;
      }
      case 'for_statement':
      case 'while_statement':
      case 'enhanced_for_statement': {
        const line = node.startPosition.row + 1;
        const loopTrace = traceCall(line, 'loop-iteration');

        const body = node.childForFieldName('body');
        if (body) {
          if (body.type === 'block') {
            if (inserts.length < 1000) {
              insertAt(inserts, body.startIndex + 1, loopTrace, 1);
            }
            stack.push(body);
          } else {
            if (inserts.length < 1000) {
              insertAt(inserts, body.startIndex, `{${loopTrace}\n`, 1);
              insertAt(inserts, body.endIndex, '\n}', -1);
            }
            stack.push(body);
          }
          traverseChildren = false;
        }
        break;
      }
      default:
        break;
    }

    if (traverseChildren) {
      for (let i = node.childCount - 1; i >= 0; i--) {
        stack.push(node.child(i));
      }
    }
  }
}

export function instrumentCode(source) {
  const ast = parser.parse(source);
  const inserts = [];

  visitIterative(source, ast.rootNode, inserts);

  inserts.sort((a, b) => a.index - b.index || b.priority - a.priority);

  const parts = [];
  let lastIndex = 0;
  for (const insert of inserts) {
    const idx = Math.min(source.length, Math.max(0, insert.index));
    parts.push(source.slice(lastIndex, idx));
    parts.push(insert.text);
    lastIndex = idx;
  }
  parts.push(source.slice(lastIndex));
  const instrumented = parts.join('');

  return { code: instrumented, hookCount: inserts.length };
}
