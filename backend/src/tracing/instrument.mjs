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

  return [...names];
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
