import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorkspaceService } from './application/workspace.js';
import { SqliteWorkspace } from './infrastructure/sqlite.js';
import { InstalledAgentDiscovery } from './infrastructure/agents.js';
import { createAppServer } from './http.js';

const dataDirectory = path.resolve(
  process.env.TRADEPILOT_DATA_DIR || '.tradepilot',
);
fs.mkdirSync(dataDirectory, { recursive: true });
const repository = new SqliteWorkspace(
  path.join(dataDirectory, 'workspace.sqlite'),
);
const uiDirectory = fileURLToPath(new URL('../ui', import.meta.url));
const server = createAppServer(
  new WorkspaceService(repository, new InstalledAgentDiscovery()),
  fs.existsSync(uiDirectory) ? uiDirectory : undefined,
);
server.listen(4317, '127.0.0.1', () =>
  console.log('TradePilot local backend: http://127.0.0.1:4317'),
);
server.on('error', (error) => {
  console.error(error.message);
  repository.close();
  process.exitCode = 1;
});
function shutdown() {
  server.close(() => {
    repository.close();
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
