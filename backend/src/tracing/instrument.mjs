import { Parser } from 'acorn';

const ecmaVersion = 'latest';

function lineOf(source, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source.charCodeAt(cursor) === 10) line += 1;
  }
  return line;
}

function getAssignedNames(node) {
  const names = new Set();

  function readPattern(pattern) {
    if (!pattern) return;
    switch (pattern.type) {
      case 'Identifier':
        names.add(pattern.name);
        break;
      case 'RestElement':
        readPattern(pattern.argument);
        break;
      case 'AssignmentPattern':
        readPattern(pattern.left);
        break;
      case 'ArrayPattern':
        pattern.elements.forEach(readPattern);
        break;
      case 'ObjectPattern':
        pattern.properties.forEach((property) => {
          if (property.type === 'Property') readPattern(property.value);
          if (property.type === 'RestElement') readPattern(property.argument);
        });
        break;
      case 'MemberExpression':
        if (pattern.object?.type === 'Identifier') names.add(pattern.object.name);
        break;
      default:
        break;
    }
  }

  if (node.type === 'VariableDeclaration') {
    node.declarations.forEach((declaration) => readPattern(declaration.id));
  }

  if (node.type === 'ExpressionStatement') {
    const expression = node.expression;
    if (expression.type === 'AssignmentExpression') readPattern(expression.left);
    if (expression.type === 'UpdateExpression') readPattern(expression.argument);
  }

  if (node.type === 'AssignmentExpression') {
    readPattern(node.left);
  }

  if (node.type === 'UpdateExpression') {
    readPattern(node.argument);
  }

  return [...names];
}

function findAssignmentsAndUpdates(node, list = []) {
  if (!node) return list;

  if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
    return list;
  }

  if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') {
    list.push(node);
  }

  for (const key in node) {
    if (node[key] && typeof node[key] === 'object') {
      if (Array.isArray(node[key])) {
        node[key].forEach((child) => findAssignmentsAndUpdates(child, list));
      } else if (node[key].type) {
        findAssignmentsAndUpdates(node[key], list);
      }
    }
  }
  return list;
}

function getSafeTempVarName(source) {
  let suffix = 0;
  let name = '__cfv_temp';
  while (source.includes(name)) {
    suffix += 1;
    name = `__cfv_temp_${suffix}`;
  }
  return name;
}

function hasAwaitOrYield(node) {
  let found = false;
  function walk(n) {
    if (!n || found) return;
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(n.type)) {
      return; // Skip walking nested function scopes
    }
    if (n.type === 'AwaitExpression' || n.type === 'YieldExpression') {
      found = true;
      return;
    }
    for (const key in n) {
      if (n[key] && typeof n[key] === 'object') {
        if (Array.isArray(n[key])) {
          n[key].forEach(walk);
        } else if (n[key].type) {
          walk(n[key]);
        }
      }
    }
  }
  walk(node);
  return found;
}


function makeSnapshot(names) {
  if (!names.length) return '{}';
  const entries = names.map((name) => `${JSON.stringify(name)}: typeof ${name} === 'undefined' ? undefined : ${name}`);
  return `({ ${entries.join(', ')} })`;
}

function traceCall(source, node, event, names = []) {
  const line = node.loc?.start?.line ?? lineOf(source, node.start);
  return `\n;__trace.capture(${line}, ${JSON.stringify(event)}, ${makeSnapshot(names)});`;
}

function insertAt(inserts, index, text, priority = 0) {
  inserts.push({ index, text, priority });
}

function visit(source, node, inserts) {
  switch (node.type) {
    case 'Program':
      node.body.forEach((child) => visit(source, child, inserts));
      break;
    case 'BlockStatement':
      node.body.forEach((child) => visit(source, child, inserts));
      break;
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      if (node.body?.type === 'BlockStatement') visit(source, node.body, inserts);
      break;
    case 'VariableDeclaration': {
      insertAt(inserts, node.end, traceCall(source, node, 'assignment', getAssignedNames(node)));
      break;
    }
    case 'ExpressionStatement': {
      if (['AssignmentExpression', 'UpdateExpression'].includes(node.expression.type)) {
        insertAt(inserts, node.end, traceCall(source, node, 'assignment', getAssignedNames(node)));
      }
      visitExpression(source, node.expression, inserts);
      break;
    }
    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
    case 'WhileStatement':
      instrumentLoop(source, node, inserts);
      break;
    case 'DoWhileStatement':
      instrumentLoop(source, node, inserts);
      break;
    case 'IfStatement':
      instrumentBranch(source, node.consequent, inserts);
      if (node.alternate) instrumentBranch(source, node.alternate, inserts);
      break;
    case 'ReturnStatement': {
      if (node.argument) {
        if (!hasAwaitOrYield(node.argument)) {
          const changes = findAssignmentsAndUpdates(node.argument);
          if (changes.length > 0) {
            const names = new Set();
            changes.forEach((expr) => {
              getAssignedNames(expr).forEach((name) => names.add(name));
            });
            if (names.size > 0) {
              const line = node.loc?.start?.line ?? lineOf(source, node.start);
              const tempVar = getSafeTempVarName(source);
              const captureCall = `__trace.capture(${line}, "assignment", ${makeSnapshot([...names])})`;
              insertAt(inserts, node.argument.start, `(() => { const ${tempVar} = (`, 1);
              insertAt(inserts, node.argument.end, `); ${captureCall}; return ${tempVar}; })()`, -1);
            }
          }
        }
        visit(source, node.argument, inserts);
      }
      break;
    }

    case 'LabeledStatement':
      visit(source, node.body, inserts);
      break;
    case 'TryStatement':
      visit(source, node.block, inserts);
      if (node.handler?.body) visit(source, node.handler.body, inserts);
      if (node.finalizer) visit(source, node.finalizer, inserts);
      break;
    case 'SwitchStatement':
      node.cases.forEach((switchCase) => switchCase.consequent.forEach((child) => visit(source, child, inserts)));
      break;
    default:
      break;
  }
}

function visitExpression(source, expression, inserts) {
  if (!expression) return;

  if (expression.type === 'CallExpression') {
    expression.arguments.forEach((argument) => {
      if (argument.type === 'FunctionExpression' || argument.type === 'ArrowFunctionExpression') visit(source, argument, inserts);
    });
  }
}

function instrumentLoop(source, node, inserts) {
  const loopTrace = traceCall(source, node, 'loop-iteration');
  if (node.body.type === 'BlockStatement') {
    insertAt(inserts, node.body.start + 1, loopTrace, 1);
    visit(source, node.body, inserts);
    return;
  }

  insertAt(inserts, node.body.start, `{${loopTrace}\n`, 1);
  insertAt(inserts, node.body.end, '\n}', -1);
  visit(source, node.body, inserts);
}

function instrumentBranch(source, branch, inserts) {
  if (!branch) return;
  if (branch.type === 'BlockStatement') {
    visit(source, branch, inserts);
    return;
  }

  insertAt(inserts, branch.start, '{\n', 1);
  insertAt(inserts, branch.end, '\n}', -1);
  visit(source, branch, inserts);
}

export function instrumentCode(source) {
  const ast = Parser.parse(source, {
    ecmaVersion,
    locations: true,
    sourceType: 'script',
    allowReturnOutsideFunction: false,
  });

  const inserts = [];
  visit(source, ast, inserts);

  const instrumented = [...inserts]
    .sort((a, b) => (b.index - a.index) || (a.priority - b.priority))
    .reduce((nextSource, insert) => `${nextSource.slice(0, insert.index)}${insert.text}${nextSource.slice(insert.index)}`, source);

  return { code: instrumented, hookCount: inserts.length };
}
