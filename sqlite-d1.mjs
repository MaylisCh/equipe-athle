// Run the same application features against local SQLite and hosted D1.
export function sqliteD1(db) {
 function statement(sql,values=[]) {
  const execute=()=>({meta:{changes:Number(db.prepare(sql).run(...values).changes)}});
  return {bind:(...args)=>statement(sql,args),first:async()=>db.prepare(sql).get(...values)||null,all:async()=>({results:db.prepare(sql).all(...values)}),run:async()=>execute(),execute};
 }
 return {
  prepare:sql=>statement(sql),exec:async sql=>db.exec(sql),
  batch:async actions=>{db.exec('BEGIN IMMEDIATE');try{const result=actions.map(a=>a.execute());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
 };
}
