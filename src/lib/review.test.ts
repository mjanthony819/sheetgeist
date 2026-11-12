import {describe,it,expect} from 'vitest';
import {threeWayMerge,resolveConflicts} from './merge';
import {validateData} from './validate';
import type {SheetData} from './types';
const sheet=(rows:SheetData['rows']):SheetData=>({columns:['name','quantity','location'],rows});
const b=sheet([{id:'01',name:'Ghost\nLantern',quantity:12,location:'Hall'}]);
describe('independent review regression tests',()=>{
 it('keeps auto-merged theirs fields while resolving conflicting field',()=>{
 const ours=sheet([{...b.rows[0],quantity:18}]);const theirs=sheet([{...b.rows[0],quantity:20,location:'Gallery'}]);
 const r=threeWayMerge(b,ours,theirs);const rows=resolveConflicts(r.conflicts,new Map([['01',new Map([['quantity','ours']])]]));
 expect(rows[0]).toEqual({...b.rows[0],quantity:18,location:'Gallery'});
 });
 it('never silently defaults unresolved fields',()=>{const r=threeWayMerge(b,sheet([{...b.rows[0],quantity:18}]),sheet([{...b.rows[0],quantity:20}]));expect(()=>resolveConflicts(r.conflicts,new Map())).toThrow()});
 it('rejects duplicate ids rather than discarding rows',()=>{expect(()=>validateData(sheet([b.rows[0],b.rows[0]]))).toThrow()});
 it('preserves numeric-looking text ids and multiline strings in canonical JSON',()=>{const d=JSON.parse(JSON.stringify(b));validateData(d);expect(d.rows[0].id).toBe('01');expect(d.rows[0].name).toContain('\n');expect(typeof d.rows[0].quantity).toBe('number')});
 it('rejects schema-changing merges explicitly',()=>{expect(()=>threeWayMerge(b,{columns:['name'],rows:[{id:'01',name:'Ghost'}]},b)).toThrow('Schema-changing')});
 it('rejects nonfinite numbers',()=>{expect(()=>validateData(sheet([{id:'x',quantity:NaN}]))).toThrow()});
 it('supports independent additions',()=>{const r=threeWayMerge(b,sheet([...b.rows,{id:'a',quantity:2}]),sheet([...b.rows,{id:'z',quantity:3}]));expect(r.data?.rows).toHaveLength(3)});
});
