import { expect, it } from 'vitest';
import { readAgentNode, AGENT_NODE_ATTRIBUTE, agentNodeMetric } from '../../src/shared/agent_node_data';
import { renderNode } from '../../src/shared/node_draw_svg';
import { renderAgentCard } from '../../src/shared/agent_node';
import example from '../../src/labs/node/fixtures/current-session.json';
import type { TreeNode } from '../../src/shared/types';
import type { NodeDrawInput } from '../../src/shared/node_draw_port';
const node: TreeNode = { id: 'saved-node', parentId: 'root', children: [], nodeType: 'text', text: 'Editable title', details: 'Editable body', note: '', link: '', collapsed: false, attributes: { [AGENT_NODE_ATTRIBUTE]: JSON.stringify({ ...example, version: 1 }) } };
it('uses canonical node identity and editable content after persistence', () => {
  const card = readAgentNode(JSON.parse(JSON.stringify(node)))!;
  expect(card).toMatchObject({ id: node.id, title: node.text, message: node.details, realm: 'Mac', team: 'M3E' });
  expect(readAgentNode({ ...node, text: 'Changed' })!.title).toBe('Changed');
  expect(agentNodeMetric(card)).toEqual({ w: 320, h: 128 });
});
it('rejects corrupt, unsupported and incomplete persisted attributes', () => {
  for (const raw of ['null', '{', '{}', JSON.stringify({ ...example, version: 2 }), JSON.stringify({ ...example, version: 1, lastActiveAt: 'invalid' }), JSON.stringify({ ...example, version: 1, lifecycleState: '<script>' })]) {
    expect(readAgentNode({ ...node, attributes: { [AGENT_NODE_ATTRIBUTE]: raw } })).toBeNull();
  }
});
it('normal renderer retains Lab glyph parity and ordinary node hit targets at all detail levels', () => {
  const card = readAgentNode(node)!;
  for (const lod of ['near', 'middle', 'far'] as const) {
    const agent = { card, width: 320, lod, displayAt: card.lastActiveAt };
    const input = { node: { id: node.id, alias: 'none' }, position: { x: 100, y: 100, w: 320, h: 128 }, view: { selected: true, lockedBy: 'none' }, surface: { view: 'Disperse' }, style: {}, content: { kind: 'agent', agent } } as NodeDrawInput;
    const output = renderNode(input);
    expect(output.svg).toContain(renderAgentCard(agent).svg);
    expect(output.svg).toContain('node-hit agent-node-hit selected');
    expect(output.svg).toContain(`data-node-id="${node.id}"`);
    expect(output.bounds.h).toBe(renderAgentCard(agent).bounds.h);
  }
});
