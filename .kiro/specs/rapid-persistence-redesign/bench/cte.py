import sqlite3, random, time, os, sys
random.seed(1)
def build(n, path):
    if os.path.exists(path): os.remove(path)
    db = sqlite3.connect(path); db.execute("PRAGMA journal_mode=WAL"); db.execute("PRAGMA synchronous=NORMAL")
    db.execute("CREATE TABLE node(id INTEGER PRIMARY KEY, parent_id INTEGER, ord TEXT, text TEXT, rev INTEGER)")
    db.execute("CREATE INDEX node_parent ON node(parent_id, ord)")
    rows=[(0,None,'a0','root',1)]
    # mind-map like: BFS growth with fan-out 2..12
    frontier=[0]; nid=1
    while nid<n:
        nxt=[]
        for p in frontier:
            k=random.randint(2,12)
            for j in range(k):
                if nid>=n: break
                rows.append((nid,p,'a%05d'%j,'node text %d lorem ipsum dolor'%nid,1)); nxt.append(nid); nid+=1
        frontier=nxt
    db.executemany("INSERT INTO node VALUES(?,?,?,?,?)",rows); db.commit()
    return db
Q="""WITH RECURSIVE sub(id,depth) AS (SELECT ?,0 UNION ALL SELECT n.id, s.depth+1 FROM node n JOIN sub s ON n.parent_id=s.id)
SELECT n.id,n.parent_id,n.ord,n.text FROM sub JOIN node n USING(id)"""
def t(f, reps=5):
    best=1e9
    for _ in range(reps):
        s=time.perf_counter(); r=f(); best=min(best,time.perf_counter()-s)
    return best, r
for n in [20150, 200000, 1000000]:
    db=build(n, '/private/tmp/claude-501/-Users-akaghef-dev-M3E/808f240b-37d0-4227-9a51-aaf58494382f/scratchpad/bench/t%d.db'%n)
    # pick subtrees of different sizes: compute sizes for depth-2/3 nodes
    sizes={}
    for nodeid in [0]+[r[0] for r in db.execute("SELECT id FROM node WHERE parent_id IN (SELECT id FROM node WHERE parent_id=0) LIMIT 3")]:
        sizes[nodeid]=len(db.execute(Q,(nodeid,)).fetchall())
    for nodeid,sz in sizes.items():
        tm,_=t(lambda: db.execute(Q,(nodeid,)).fetchall())
        print(f"n={n} subtree_root={nodeid} subtree_rows={sz} read_ms={tm*1000:.1f}")
    # move: reparent one node (adjacency list) in a txn
    def mv():
        with db: db.execute("UPDATE node SET parent_id=?, ord=?, rev=rev+1 WHERE id=?", (5,'zz', list(sizes)[1]))
    tm,_=t(mv); print(f"n={n} move(reparent 1 row, txn commit) ms={tm*1000:.2f}")
    # cycle check before move: is target inside moved subtree?
    tm,_=t(lambda: db.execute("WITH RECURSIVE anc(id) AS (SELECT ? UNION ALL SELECT n.parent_id FROM node n JOIN anc a ON n.id=a.id WHERE n.parent_id IS NOT NULL) SELECT 1 FROM anc WHERE id=?",(n-1, list(sizes)[1])).fetchall())
    print(f"n={n} ancestor-walk cycle check ms={tm*1000:.2f}")
    # batch 1000 single-row updates in one txn
    ids=random.sample(range(1,n),1000)
    def batch():
        with db: db.executemany("UPDATE node SET text=text||'x', rev=rev+1 WHERE id=?", [(i,) for i in ids])
    tm,_=t(batch,3); print(f"n={n} 1000 updates one txn ms={tm*1000:.1f}")
    print(f"n={n} file_MB={os.path.getsize('/private/tmp/claude-501/-Users-akaghef-dev-M3E/808f240b-37d0-4227-9a51-aaf58494382f/scratchpad/bench/t%d.db'%n)/1e6:.1f}")
    db.close()
print("sqlite", sqlite3.sqlite_version)
