import json, sqlite3, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[1]
seed=json.loads((root/(sys.argv[1] if len(sys.argv)>1 else 'data/seed.json')).read_text())
for path in (root/'.wrangler/state').rglob('*.sqlite'):
    if path.name.startswith('._'):continue
    con=sqlite3.connect(path)
    if con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='heritage_sites'").fetchone():break
    con.close()
else:raise RuntimeError('Apply local schema migration first.')
con.execute('PRAGMA foreign_keys = ON')
with con:
    for table in ['sources','heritage_sites','indicators','scores','dimension_scores','data_issues','spatial_matches']:
        rows=seed.get(table,[])
        if not rows:continue
        cols=list(rows[0]);sql=f'INSERT INTO {table} ({",".join(cols)}) VALUES ({",".join("?" for _ in cols)})'
        con.executemany(sql,[[r[c] for c in cols] for r in rows])
        print(table,len(rows))
con.close()
