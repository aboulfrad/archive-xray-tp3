import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const client = new Client({ name: 'archive-xray-validation', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['scripts/mcp-server.mjs'],
  cwd: process.cwd(),
});
try {
  await client.connect(transport);
  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map((t) => t.name).sort(), ['explain_check', 'read_contract']);
  const contract = await client.callTool({ name: 'read_contract', arguments: {} });
  assert.equal(contract.isError, undefined);
  assert.ok(JSON.stringify(contract).includes('Aucun code'));
  const explanation = await client.callTool({ name: 'explain_check', arguments: { rule: 'crc' } });
  assert.ok(JSON.stringify(explanation).includes('cryptographique'));
  const rejected = await client.callTool({
    name: 'explain_check',
    arguments: { rule: '../../.env' },
  });
  assert.equal(rejected.isError, true);
  const proof = {
    time: new Date().toISOString(),
    transport: 'stdio',
    client: 'SDK MCP officiel, pas un appel de modèle',
    tools: tools.tools.map((t) => t.name),
    contractRead: true,
    example: explanation,
    arbitrarySelectorRejected: rejected.isError,
  };
  await mkdir('preuves', { recursive: true });
  await writeFile('preuves/mcp.json', JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof, null, 2));
} finally {
  await client.close();
}
