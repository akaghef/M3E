import { describe, it, expect } from 'vitest';
import { ConcretenessView, projectConcreteness, concretenessSubtree, reconnectConcretenessCopies } from '../../src/shared/concreteness_axis';
import type { AppState, TreeNode } from '../../src/shared/types';
const node = (id: string, parentId: string | null, children: string[], scope = false): TreeNode => ({
  id, parentId, children, nodeType: scope ? 'folder' : 'text', text: id,
  collapsed: false, details: '', note: '', attributes: {}, link: '',
});
const fixture = (): AppState => ({rootId:'root',nodes:{
  root:node('root',null,['X','Y']), X:node('X','root',['A','C']), Y:node('Y','root',['B','D']),
  A:node('A','X',['a'],true),a:node('a','A',[]),C:node('C','X',['c'],true),c:node('c','C',[]),
  B:node('B','Y',['b'],true),b:node('b','B',[]),D:node('D','Y',[],true),
}, links:{ hidden:{id:'hidden',sourceNodeId:'b',targetNodeId:'c',label:'retain'} }});

describe('Concreteness Axis',()=>{
  it('projects all scope boundaries into ordinary nodes without changing legacy data',()=>{
    const source=fixture(), original=JSON.stringify(source);
    const view=new ConcretenessView(source,-1);
    expect(Object.keys(view.state.nodes)).toEqual(['root','A','C','B','D']);
    expect(view.state.nodes.root.children).toEqual(['A','C','B','D']);
    expect(Object.values(view.state.nodes).every(n=>n.nodeType==='text')).toBe(true);
    expect(JSON.stringify(view.commit())).toBe(original);
    expect(JSON.stringify(source)).toBe(original);
  });
  it('groups across original parents, creates a scope, collapses again, and survives reload',()=>{
    const source=fixture(),view=new ConcretenessView(source,-1),n=view.state.nodes;
    n.G=node('G','root',['C','B'],true);
    n.root.children=['A','G','D'];n.C.parentId='G';n.B.parentId='G';
    const saved=JSON.parse(JSON.stringify(view.commit()));
    expect(saved.nodes.C.parentId).toBe('X');expect(saved.nodes.B.parentId).toBe('Y');
    expect(saved.nodes.X.children).toEqual(['A','C']);expect(saved.nodes.Y.children).toEqual(['B','D']);
    expect(saved.links.hidden.label).toBe('retain');
    const reopened=projectConcreteness(saved,-1);
    expect(reopened.nodes.G.children).toEqual(['C','B']);expect(reopened.nodes.G.nodeType).toBe('folder');
    const coarser=projectConcreteness(saved,-2);
    expect(Object.keys(coarser.nodes)).toEqual(['root','G']);expect(coarser.nodes.G.nodeType).toBe('text');
    const ordinary=projectConcreteness(saved,0);
    expect(ordinary.nodes.G).toBeUndefined();expect(ordinary.nodes.X.children).toEqual(['A','C']);
    expect(ordinary.nodes.B.children).toEqual(['b']);
    const again=new ConcretenessView(saved,-2);again.state.nodes.G.nodeType='folder';
    expect(projectConcreteness(again.commit(),-3).nodes.G).toBeDefined();
  });
  it('scopen and unscopen at a coarse level do not change the original boundary',()=>{
    const view=new ConcretenessView(fixture(),-1);
    view.state.nodes.A.nodeType='folder';let saved=view.commit();
    expect(projectConcreteness(saved,-2).nodes.A).toBeDefined();
    view.state.nodes.A.nodeType='text';saved=view.commit();
    expect(saved.nodes.A.nodeType).toBe('folder');
    expect(projectConcreteness(saved,-2).nodes.A).toBeUndefined();
  });
  it('shares content edits while preserving hidden content and relations',()=>{
    const view=new ConcretenessView(fixture(),-1);
    view.state.nodes.B.text='Updated';view.state.nodes.B.attributes.color='blue';
    const saved=view.commit();
    expect(saved.nodes.B.text).toBe('Updated');expect(saved.nodes.B.attributes.color).toBe('blue');
    expect(saved.nodes.b.text).toBe('b');expect(saved.links?.hidden).toBeDefined();
    expect(projectConcreteness(saved,0).nodes.B.text).toBe('Updated');
  });
  it('deletes the represented subtree including hidden content, retaining unrelated data',()=>{
    const view=new ConcretenessView(fixture(),-1);
    delete view.state.nodes.B;view.state.nodes.root.children=['A','C','D'];
    const saved=view.commit();expect(saved.nodes.B).toBeUndefined();expect(saved.nodes.b).toBeUndefined();
    expect(saved.nodes.Y.children).toEqual(['D']);expect(saved.nodes.c).toBeDefined();
    expect(saved.links?.hidden).toBeUndefined();
  });
  it('expands one additional scope layer at each positive level',()=>{
    const source=fixture();source.nodes.a.nodeType='folder';source.nodes.a.children=['aa'];source.nodes.aa=node('aa','a',[]);
    expect(projectConcreteness(source,0).nodes.A.nodeType).toBe('folder');
    expect(projectConcreteness(source,1).nodes.A.nodeType).toBe('text');
    expect(projectConcreteness(source,1).nodes.a.nodeType).toBe('folder');
    expect(projectConcreteness(source,2).nodes.a.nodeType).toBe('text');
    const view=new ConcretenessView(source,1);view.state.nodes.A.text='Same object';
    expect(view.commit().nodes.A.nodeType).toBe('folder');
  });
  it('keeps new positive-level nodes connected in canonical storage',()=>{
    const view=new ConcretenessView(fixture(),1);
    view.state.nodes.extra=node('extra','A',[]);view.state.nodes.A.children.push('extra');
    const saved=view.commit();expect(saved.nodes.A.children).toContain('extra');
    expect(projectConcreteness(saved,0).nodes.extra.parentId).toBe('A');
  });
});

it('copies a coarse grouping with canonical contents and remaps all level parents',()=>{
 const view=new ConcretenessView(fixture(),-1),n=view.state.nodes;
 n.G=node('G','root',['C','B'],true);n.root.children=['A','G','D'];n.C.parentId='G';n.B.parentId='G';
 const saved=view.commit(),sub=concretenessSubtree(saved,view.state,'G');
 expect(Object.keys(sub.nodes).sort()).toEqual(['B','C','G','b','c']);
 expect(sub.links?.hidden).toBeDefined();
 const target=fixture(),ids=new Map(Object.keys(sub.nodes).map(id=>[id,`copy-${id}`]));
 for(const [id,value] of Object.entries(sub.nodes)){
  const copied=structuredClone(value);copied.id=ids.get(id)!;copied.parentId=ids.get(value.parentId!)||'D';copied.children=value.children.map(c=>ids.get(c)!);target.nodes[copied.id]=copied;
 }
 target.nodes.D.children.push('copy-G');
 reconnectConcretenessCopies(target,ids,['copy-G'],'D',-1);
 const coarse=projectConcreteness(target,-1);
 expect(coarse.nodes['copy-G'].parentId).toBe('D');
 expect(coarse.nodes['copy-G'].children).toEqual(['copy-C','copy-B']);
 expect(target.nodes['copy-B'].children).toEqual(['copy-b']);
 expect(projectConcreteness(target,0).nodes['copy-b']).toBeDefined();
 expect(projectConcreteness(target,0).nodes['copy-G']).toBeUndefined();
 expect(projectConcreteness(sub,-1).nodes.G).toBeDefined();
});
