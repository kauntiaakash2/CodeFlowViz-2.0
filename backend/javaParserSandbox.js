import Parser from 'tree-sitter';
import Java from 'tree-sitter-java';

// Initialize the parser
const parser = new Parser();
parser.setLanguage(Java);

// The standard algorithm snippet to test
const sourceCode = `
class BinarySearch {
    int binarySearch(int arr[], int x) {
        int l = 0, r = arr.length - 1;
        while (l <= r) {
            int m = l + (r - l) / 2;
            if (arr[m] == x) return m;
            if (arr[m] < x) l = m + 1;
            else r = m - 1;
        }
        return -1;
    }
}
`;

// Parse the source code into an AST
const tree = parser.parse(sourceCode);

// Print the raw syntax tree (LISP-style string)
console.log("AST Successfully Generated:");
console.log(tree.rootNode.toString());
