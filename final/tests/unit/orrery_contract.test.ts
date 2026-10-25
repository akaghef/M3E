import { it, expect } from 'vitest';
import { normalizeCodexAppSnapshot, validateOrrerySnapshot } from '../../src/shared/orrery_observation';
const t='2026-09-22T00:00:00Z';
function fixture(){return normalizeCodexAppSnapshot({schema_version:1,generated_at:t,runtimes:['a','b'].map(id=>({external_id:id,session_id:id,agent_name:id,program:'codex',state:'idle',last_seen_at:t,capabilities:[]}))},{id:'src',hostId:'host'});}
it('rejects malformed identity',()=>{const s=fixture();s.actors[0].id='wrong';expect(()=>validateOrrerySnapshot(s)).toThrow('identity_mismatch');});
it('validates endpoint, evidence, and reply references',()=>{
 const s=fixture(),[a,b]=s.actors;s.relations.push({id:'r',sourceActorId:a.id,targetActorId:'missing',type:'conversation',evidenceIds:[],provenance:a.provenance});
 expect(()=>validateOrrerySnapshot(s)).toThrow('unknown_endpoint');s.relations[0].targetActorId=b.id;
 expect(()=>validateOrrerySnapshot(s)).toThrow('missing_evidence');s.relations[0].evidenceIds=['e'];
 expect(()=>validateOrrerySnapshot(s)).toThrow('unknown_evidence');s.evidence.push({id:'e',sourceActorId:a.id,targetActorId:b.id,sentAt:t,provenance:a.provenance,replyToId:'missing'});
 expect(()=>validateOrrerySnapshot(s)).toThrow('unknown_reply');delete s.evidence[0].replyToId;
 expect(validateOrrerySnapshot(s).relations).toHaveLength(1);s.evidence[0].targetActorId=a.id;
 expect(()=>validateOrrerySnapshot(s)).toThrow('endpoint_mismatch');
});
it('allows humans without native sessions and detaches validated output',()=>{const s=fixture();s.actors[0].kind='human';delete s.actors[0].nativeSessionRef;const copy=validateOrrerySnapshot(s);copy.actors[0].name='other';expect(s.actors[0].name).toBe('a');});
it('rejects unknown portable fields rather than leaking unvalidated data',()=>{const s=fixture();(s.actors[0] as any).secret='not exported';expect(()=>validateOrrerySnapshot(s)).toThrow('unknown_field');});
