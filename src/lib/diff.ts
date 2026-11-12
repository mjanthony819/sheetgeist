import type { SheetData } from './types';
import {validateData} from './validate';
export type CellValue = string|number|boolean|null|undefined;
export interface FieldChange{field:string;before:CellValue;after:CellValue}
export interface RowChange{id:string;kind:'added'|'removed'|'modified';fields:FieldChange[]}
export interface SnapshotDiff{rows:RowChange[];columnsAdded:string[];columnsRemoved:string[];columnOrderChanged:boolean;added:number;removed:number;modified:number}
export function diffSnapshots(before:SheetData,after:SheetData):SnapshotDiff{
 validateData(before);validateData(after);
 const a=new Map(before.rows.map(r=>[r.id,r])),b=new Map(after.rows.map(r=>[r.id,r]));
 const columns=[...new Set([...before.columns,...after.columns])];const rows:RowChange[]=[];
 for(const id of new Set([...before.rows.map(r=>r.id),...after.rows.map(r=>r.id)])){
  const old=a.get(id),next=b.get(id);const fields=columns.filter(c=>old?.[c]!==next?.[c]).map(field=>({field,before:old?.[field],after:next?.[field]}));
  if(!old&&next)rows.push({id,kind:'added',fields});else if(old&&!next)rows.push({id,kind:'removed',fields});else if(fields.length)rows.push({id,kind:'modified',fields});
 }
 return{rows,columnsAdded:after.columns.filter(c=>!before.columns.includes(c)),columnsRemoved:before.columns.filter(c=>!after.columns.includes(c)),columnOrderChanged:JSON.stringify(before.columns)!==JSON.stringify(after.columns),added:rows.filter(r=>r.kind==='added').length,removed:rows.filter(r=>r.kind==='removed').length,modified:rows.filter(r=>r.kind==='modified').length};
}
export function formatCell(value:CellValue):string{
 if(value===undefined)return '(missing)';if(value===null)return 'null';if(typeof value==='string')return JSON.stringify(value);return String(value);
}
export function prepareRestore(current:SheetData,target:SheetData):SheetData{
 validateData(current);validateData(target);
 if(JSON.stringify(current)===JSON.stringify(target))throw new Error('This snapshot already matches the current data.');
 return JSON.parse(JSON.stringify(target)) as SheetData;
}
