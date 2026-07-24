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

function visit(source, node, inserts) {
  switch (node.type) {
    case 'local_variable_declaration':
    case 'assignment_expression':
    case 'update_expression': {
      // Tree-sitter rows are 0-indexed, UI expects 1-indexed
      const line = node.startPosition.row + 1;
      insertAt(inserts, node.endIndex, traceCall(line, 'assignment'));
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
          insertAt(inserts, body.startIndex + 1, loopTrace, 1);
          visit(source, body, inserts);
        } else {
          insertAt(inserts, body.startIndex, `{${loopTrace}\n`, 1);
          insertAt(inserts, body.endIndex, '\n}', -1);
          visit(source, body, inserts);
        }
        return;
      }
      break;
    }
    default:
      break;
  }
  
  for (let i = 0; i < node.childCount; i++) {
    visit(source, node.child(i), inserts);
  }
}

export function instrumentCode(source) {
  const ast = parser.parse(source);
  const inserts = [];
  
  visit(source, ast.rootNode, inserts);

  const instrumented = [...inserts]
    .sort((a, b) => (b.index - a.index) || (a.priority - b.priority))
    .reduce((nextSource, insert) => 
      `${nextSource.slice(0, insert.index)}${insert.text}${nextSource.slice(insert.index)}`, 
      source
    );

  return { code: instrumented, hookCount: inserts.length };
}
