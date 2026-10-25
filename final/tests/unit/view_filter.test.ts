import { describe, expect, it } from 'vitest';
import { evaluateViewFilter, defaultFilterSelection, axisMatches, domainNames, edgeMatches } from '../../src/shared/view_filter';
import { attributeScore, VIEW_FILTER_AXES, type FilterAxis } from '../../src/shared/view_filter_axes';
import fs from 'node:fs';
const node = (id: string, attributes = {}) => ({ id, attributes });
const link = (id: string, sourceNodeId: string, targetNodeId: string, confidence?: string) => ({ id, sourceNodeId, targetNodeId, attributes: confidence === undefined ? {} : {confidence} });
const select = (overrides = {}) => ({...defaultFilterSelection(), ...overrides});
describe('score and generic axis contract', () => {
  it.each([['',0],['unknown',0],['-1',0],['2.5',0],['0',0],['01',1],['2',2],['3',3],['4',4],['999',999],['low',1],['l',1],['低',1],['medium',2],['mid',2],['m',2],['中',2],['high',3],['top',3],['h',3],['高',3],['critical',4],['urgent',4],['highest',4],['緊急',4],[' HIGH ',3]])('scores %s', (raw, expected) => expect(attributeScore(raw)).toBe(expected));
  it('uses nullish precedence, never truthiness, and no ancestor rescue', () => {
    const input = {nodes:[node('root'),node('a',{importance:'',priority:'4'}),node('b',{priority:'3'}),node('c',{'重要度':'2'})], links:[]};
    expect([...evaluateViewFilter(input,select({importance:'medium-plus'})).nodes]).toEqual(['b','c']);
  });
  it.each(['node','GraphLink'] as const)('evaluates custom score/exact/multiple definitions for %s', target => {
    for (const kind of ['score','exact','multiple'] as const) {
      const axis: FilterAxis = { id:'custom',label:'Custom',target,keys:['first','second'],kind,all:kind === 'multiple' ? [] : 'all', options:[{value:'chosen',label:'Chosen',meaning:'value',minimum:2}] };
      const value = kind === 'multiple' ? ['x'] : 'chosen';
      const raw = kind === 'score' ? '2' : kind === 'exact' ? 'chosen' : 'x,y';
      expect(axisMatches(node('n',{second:raw}),axis,value)).toBe(true);
      const input = {nodes:[node('a',{second:raw}),node('b',{second:raw})],links:[{...link('ab','a','b'),attributes:{second:raw}}]};
      expect(evaluateViewFilter(input,{custom:value},[axis]).links.has('ab')).toBe(true);
      expect(axisMatches(node('n',{first:'',second:raw}),axis,value)).toBe(false);
    }
  });
  it('distinguishes absent keys from empty/unknown keys and keeps one candidate enabled', () => {
    expect(VIEW_FILTER_AXES.map(a=>a.label)).toEqual(['実現段階','重要度','緊急度','所属']);
    const r = evaluateViewFilter({nodes:[node('a',{domain:'',urgency:'unknown',importance:''}),node('b',{domain:'Research'})],links:[]},select());
    expect(r.axes.domain).toEqual({enabled:true,active:false,candidates:['Research']});
    expect(r.axes.urgency.enabled).toBe(true); expect(r.axes.importance.enabled).toBe(true);expect(r.axes.realization.enabled).toBe(false);
    expect(domainNames(' A, B , ,A,B ')).toEqual(['A','B']);
  });
});
describe('one-pass B / P / L / M', () => {
  const input = {nodes:[node('a',{domain:'R',importance:'3',urgency:'2'}),node('b',{domain:'R',importance:'2',urgency:'3'}),node('outside',{domain:'X'}),node('isolated',{domain:'R'}),node('externalOnly',{domain:'R'})],
    links:[link('ab','a','b','system-evidenced'),link('out','externalOnly','outside','system-evidenced'),link('unknown','a','outside','other'),link('declared','a','isolated','declared'),link('missing','b','outside')]};
  it('keeps matching isolated nodes without CURRENT; combines axes and both endpoints', () => {
    const saved = structuredClone(input);
    const all = evaluateViewFilter(input,select()); expect(all.nodes.size).toBe(5);expect(all.links.size).toBe(5);
    const domain = evaluateViewFilter(input,select({domain:['R']}));expect([...domain.nodes]).toEqual(['a','b','isolated','externalOnly']);expect([...domain.links]).toEqual(['ab','declared']);
    const current = evaluateViewFilter(input,select({domain:['R'],realization:'system-evidenced'}));expect([...current.nodes]).toEqual(['a','b']);expect([...current.links]).toEqual(['ab']);
    expect(edgeMatches(current,'a','b')).toBe(true);expect(edgeMatches(current,'a','isolated')).toBe(false);
    const and = evaluateViewFilter(input,select({importance:'medium-plus',urgency:'high-plus'}));expect([...and.nodes]).toEqual(['b']);expect(and.links.size).toBe(0);
    expect(evaluateViewFilter(input,select({domain:['R','X']})).nodes.size).toBe(5);
    expect(input).toEqual(saved);
  });
  it('counts rendered representatives and preserves original link confidence', () => {
    const result = evaluateViewFilter({nodes:[node('card1'),node('card2')],links:[link('hidden-relation','card1','card2','system-evidenced')]},select({realization:'system-evidenced'}));
    expect(result.nodeCount).toBe(2);expect(result.linkCount).toBe(1);expect([...result.nodes]).toEqual(['card1','card2']);
  });
  it('matches independent Research sets and fixture derivation', () => {
    const original = JSON.parse(fs.readFileSync(new URL('../fixtures/lane_asys.json',import.meta.url),'utf8'));
    const derived = JSON.parse(fs.readFileSync(new URL('../fixtures/lane_asys_domains.json',import.meta.url),'utf8'));
    const research = new Set(['res','obsidian','chrome','miro','mac','dell','ipad','gd','chats','codex','ha','akos'].map(id=>'item_'+id));
    const nodes = Object.values(derived.state.nodes).filter((n:any)=>n.id.startsWith('item_')) as any[];
    expect(new Set(nodes.filter(n=>n.attributes.domain.split(',').includes('Research')).map(n=>n.id))).toEqual(research);
    const links = Object.values(original.state.links) as any[];
    const expectedLinks = links.filter(l=>research.has(l.sourceNodeId)&&research.has(l.targetNodeId));
    expect(expectedLinks).toHaveLength(26);
    const currentLinks = expectedLinks.filter(l=>l.attributes?.confidence==='system-evidenced');expect(currentLinks).toHaveLength(1);
    const currentNodes = new Set(currentLinks.flatMap(l=>[l.sourceNodeId,l.targetNodeId]));expect(currentNodes).toEqual(new Set(['item_mac','item_dell']));
    const input = {nodes,links};
    expect(evaluateViewFilter(input,select({domain:['Research']})).nodes).toEqual(research);
    const result = evaluateViewFilter(input,select({domain:['Research'],realization:'system-evidenced'}));expect(result.nodes).toEqual(currentNodes);expect(result.links).toEqual(new Set(currentLinks.map(l=>l.id)));
    nodes.forEach(n=>delete n.attributes.domain);expect(derived).toEqual(original);
  });
});
