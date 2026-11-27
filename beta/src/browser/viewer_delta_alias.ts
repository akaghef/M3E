import type {AppState} from '../shared/types';

/** Target-to-alias references; rebuilt only for a new/unknown state. */
export class AliasIndex {
  private state:AppState|null=null;
  private targets=new Map<string,string>();
  private aliases=new Map<string,Set<string>>();
  change(state:AppState,ids?:readonly string[],unknown=false):void {
    if(this.state!==state||unknown){this.state=state;this.targets.clear();this.aliases.clear();ids=Object.keys(state.nodes);}
    for(const id of ids??[]) {
      const old=this.targets.get(id);
      if(old){const bucket=this.aliases.get(old);bucket?.delete(id);if(!bucket?.size)this.aliases.delete(old);this.targets.delete(id);}
      const node=state.nodes[id];
      if(node?.nodeType!=='alias'||!node.targetNodeId)continue;
      this.targets.set(id,node.targetNodeId);
      const bucket=this.aliases.get(node.targetNodeId)??new Set<string>();bucket.add(id);this.aliases.set(node.targetNodeId,bucket);
    }
  }
  forTarget(state:AppState,target:string):string[] {
    this.change(state);
    return [...(this.aliases.get(target)??[])].filter(id=>{const node=state.nodes[id];return node&&!node.aliasLabel&&!node.isBroken;});
  }
}
