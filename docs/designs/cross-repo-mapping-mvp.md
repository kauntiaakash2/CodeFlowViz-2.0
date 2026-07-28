# MVP Design: Cross-Repository Dependency Mapping

## 1. Input and Authentication
- **MVP Scope:** Static analysis of local directories. Users supply absolute paths to multiple local repository folders via the CLI/Config.
- **Auth:** Deferred. By using local directories, we avoid GitHub/GitLab API token management in the MVP.

## 2. Supported Dependency Types
- **Initial Focus:** REST API calls only.
- **Detection:** We will parse `fetch`, `axios`, and standard HTTP client patterns, looking for hardcoded endpoints or config-injected URLs that match the OpenAPI specs of the other supplied repositories.

## 3. Cross-Repository Graph Schema
- Nodes will receive a new metadata field: `repositoryName`.
- Edges will introduce a new type: `CrossRepoEdge` indicating network boundaries.
- **Visual:** Nodes from different repos will be color-coded or grouped into distinct bounding boxes (subgraphs).

## 4. Security Boundaries
- The parser will only read files and will not execute any code (pure AST parsing).
- No network requests are made during the analysis phase.

## 5. Failure Handling
- If a repo cannot be parsed (syntax error, unsupported language), it will be skipped with a CLI warning, and the graph will generate for the remaining successful repos.

## 6. Test Fixtures
- Create a mock `ServiceA` (calling an endpoint) and `ServiceB` (defining the endpoint) in the `tests/fixtures/` directory.
- Verify that the resulting graph AST contains a `CrossRepoEdge` between them.
