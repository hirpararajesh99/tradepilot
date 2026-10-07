import fs from 'node:fs';
import path from 'node:path';
import type { AgentDiscovery } from '../application/ports.js';
import type { AgentStatus } from '../../shared/contracts.js';

export class InstalledAgentDiscovery implements AgentDiscovery {
  list(): AgentStatus[] {
    return (['codex', 'claude', 'cursor'] as const).map((provider) => {
      const commands =
        provider === 'cursor' ? ['cursor-agent', 'agent'] : [provider];
      let executable: string | null = null;
      const extensions =
        process.platform === 'win32'
          ? ['', ...(process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';')]
          : [''];
      for (const directory of (process.env.PATH || '')
        .split(path.delimiter)
        .filter(Boolean)) {
        for (const command of commands)
          for (const extension of extensions) {
            const candidate = path.join(
              directory.replace(/^"|"$/g, ''),
              command + extension,
            );
            try {
              if (fs.statSync(candidate).isFile()) executable ??= candidate;
            } catch {
              /* Missing PATH entries are expected during discovery. */
            }
          }
      }
      return {
        provider,
        detected: Boolean(executable),
        executable,
        authentication: 'not-checked',
      };
    });
  }
}
