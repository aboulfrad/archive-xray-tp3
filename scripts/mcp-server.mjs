import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
const server = new McpServer({ name: 'archive-contract', version: '1.0.0' });
const docs = [
  'DESIGN.md',
  'SECURITY.md',
  'TESTPLAN.md',
  '.agents/skills/archive-inspection/SKILL.md',
];
const explanations = {
  'unsafe-path':
    'Chemins absolus, traversée, flux NTFS, segments ambigus : lecture et export refusés. Aucune extraction sur disque.',
  ratio:
    'Expansion annoncée > 200:1 et taille > 64 Kio : contenu non décompressé. Contrôle supplémentaire de la taille réelle pendant DEFLATE.',
  crc: 'CRC32 et taille réelle contrôlés après lecture. Le CRC détecte des corruptions mais ne constitue pas une preuve cryptographique.',
  secret:
    'Heuristiques uniquement : tokens, clés privées, affectations et connexions. Masquage par défaut ; faux positifs/négatifs possibles.',
  checklist:
    'Présence de fichiers uniquement, hors dépendances. Ne prouve jamais tests, CI, hooks, MCP ou agents effectivement exécutés.',
};
server.registerTool(
  'read_contract',
  {
    description:
      'Lire uniquement les quatre documents publics du contrat du projet, sans chemin arbitraire.',
    inputSchema: {},
  },
  async () => {
    const parts = await Promise.all(
      docs.map(
        async (file) =>
          `${file}\n${(await readFile(new URL('../' + file, import.meta.url), 'utf8')).slice(0, 12000)}`,
      ),
    );
    return { content: [{ type: 'text', text: parts.join('\n\n') }] };
  },
);
server.registerTool(
  'explain_check',
  {
    description: 'Expliquer un contrôle de l’inspecteur et ses limites.',
    inputSchema: { rule: z.enum(['unsafe-path', 'ratio', 'crc', 'secret', 'checklist']) },
  },
  async ({ rule }) => ({ content: [{ type: 'text', text: explanations[rule] }] }),
);
await server.connect(new StdioServerTransport());
