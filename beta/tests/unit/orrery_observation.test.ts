import { it, expect } from 'vitest';
import { normalizeCodexAppSnapshot as normalize, mergeOrrerySnapshots, markOrrerySourceUnavailable } from '../../src/shared/orrery_observation';
export const time = '2026-09-22T00:00:00Z';
export const source = { id: 'src', hostId: 'host' };
export function payload(state = 'thinking') { return { schema_version: 1, generated_at: time, runtimes: ['a','b'].map(id => ({ external_id:id, session_id:id, agent_name:'same', program:'codex', state, last_seen_at:time, capabilities:[] })) }; }
it('separates hosts and rejects duplicate/stale snapshots', () => {
 const a = normalize(payload(),source), b = normalize(payload(), {...source,hostId:'second'});
 expect(mergeOrrerySnapshots([a,b]).actors).toHaveLength(4);
 expect(() => normalize({...payload(),generated_at:'2026-09-21T00:00:00Z'},source,a)).toThrow('stale_snapshot');
 const p=payload();p.runtimes[1]=p.runtimes[0]; expect(() => normalize(p,source)).toThrow('duplicate_identity');
});
it.each(['working','waiting','dormant','new-state','blocked'])('does not infer attention for %s', state => {
 const s=normalize(payload(state),source); expect(s.attention).toEqual([]);
 if(state!=='blocked')expect(s.actors[0].lifecycleState).toBeUndefined();
});
it('preserves disappearance as unobservable without mutating last good data',()=>{
 const a=normalize(payload(),source), b=normalize({...payload(),runtimes:[],generated_at:'2026-09-22T01:00:00Z'},source,a);
 expect(b.actors).toHaveLength(2); expect(b.actors[0].lifecycleState).toBe('unobservable');
 expect(a.actors[0].observationState).toBe('observed');expect(markOrrerySourceUnavailable(a).sources[0].state).toBe('unobservable');
});
it('keeps resumed external identity stable and forks distinct with an explicit spawn link',()=>{
 const p=payload(); Object.assign(p.runtimes[1],{parent_external_id:'a',session_id:'a'});
 const first=normalize(p,source), resumed=normalize({...p,generated_at:'2026-09-22T01:00:00Z'},source,first);
 expect(resumed.actors.map(a=>a.id)).toEqual(first.actors.map(a=>a.id));expect(new Set(resumed.actors.map(a=>a.id)).size).toBe(2);
 expect(resumed.relations[0].type).toBe('spawn');
});
it('drops unresolved parent refs and ignores transport counts for attention',()=>{
 const p=payload();Object.assign(p.runtimes[0],{parent_external_id:'absent',delivery:{pending_count:7,failed_count:9}});
 const s=normalize(p,source);expect(s.relations).toEqual([]);expect(s.attention).toEqual([]);expect(s.actors[0].parentActorId).toBeUndefined();
});
it('reconciles portable disappearance and source loss without inferring completion',async()=>{
 const {reconcileOrrerySnapshot,emptyOrrerySnapshot}=await import('../../src/shared/orrery_observation');
 const a=normalize(payload(),source), next={...a,generatedAt:'2026-09-22T01:00:00Z',actors:[]};
 const b=reconcileOrrerySnapshot(next,a);expect(b.actors).toHaveLength(2);expect(b.actors[0].observationState).toBe('unobservable');
 const missing=reconcileOrrerySnapshot(emptyOrrerySnapshot(),a);expect(missing.sources[0].state).toBe('unobservable');expect(missing.actors).toHaveLength(2);
 const old={...a,sources:a.sources.map(s=>({...s,observedAt:'2026-09-21T00:00:00Z'}))};expect(()=>reconcileOrrerySnapshot(old,a)).toThrow('stale_snapshot');
});
