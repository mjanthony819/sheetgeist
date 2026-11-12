import{describe,it,expect}from'vitest';
import{diffSnapshots,formatCell,prepareRestore}from'./diff';
import type{SheetData}from'./types';
const sheet=(rows:SheetData['rows'],columns=['name','value']):SheetData=>({rows,columns});
const base=sheet([{id:'a',name:'Lantern',value:1}]);
describe('typed snapshot differences',()=>{
 it('reports no change for equal snapshots',()=>expect(diffSnapshots(base,structuredClone(base)).rows).toEqual([]));
 it('reports exact modified fields, preserving scalar types',()=>{const d=diffSnapshots(base,sheet([{id:'a',name:'Lantern',value:'1'}]));expect(d.modified).toBe(1);expect(d.rows[0].fields).toEqual([{field:'value',before:1,after:'1'}])});
 it('reports added and removed identities independently',()=>{const d=diffSnapshots(base,sheet([{id:'b',name:'Mirror',value:2}]));expect([d.added,d.removed,d.modified]).toEqual([1,1,0])});
 it('does not call reordered rows modified',()=>{const a=sheet([...base.rows,{id:'b',value:3}]);expect(diffSnapshots(a,sheet([...a.rows].reverse())).rows).toEqual([])});
 it('distinguishes null, empty string and absent values',()=>{expect(diffSnapshots(sheet([{id:'a',value:null}]),sheet([{id:'a',value:''}])).modified).toBe(1);expect(diffSnapshots(sheet([{id:'a'}]),sheet([{id:'a',value:null}])).modified).toBe(1)});
 it('tracks schema addition and removal',()=>{const d=diffSnapshots(base,sheet([{id:'a',value:1,extra:'x'}],['value','extra']));expect(d.columnsAdded).toEqual(['extra']);expect(d.columnsRemoved).toEqual(['name'])});
 it('marks column reordering explicitly',()=>expect(diffSnapshots(base,{...base,columns:['value','name']}).columnOrderChanged).toBe(true));
 it('rejects duplicate IDs rather than hiding differences',()=>expect(()=>diffSnapshots(base,sheet([base.rows[0],base.rows[0]]))).toThrow());
 it('labels string and null types honestly',()=>{expect(formatCell('1')).toBe('"1"');expect(formatCell(1)).toBe('1');expect(formatCell(null)).toBe('null');expect(formatCell(undefined)).toBe('(missing)')});
});
describe('non-destructive restore planning',()=>{
 it('returns an independent validated copy without mutating current or target',()=>{const target=sheet([{id:'a',value:3}]);const restored=prepareRestore(base,target);restored.rows[0].value=9;expect(target.rows[0].value).toBe(3);expect(base.rows[0].value).toBe(1)});
 it('rejects a no-op restore',()=>expect(()=>prepareRestore(base,base)).toThrow('already matches'));
 it('rejects invalid targets before any write',()=>expect(()=>prepareRestore(base,sheet([{id:'a',value:NaN}]))).toThrow());
 it('allows restoring an earlier schema as a whole snapshot',()=>{const target=sheet([{id:'x',other:true}],['other']);expect(prepareRestore(base,target)).toEqual(target)});
});
