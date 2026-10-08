import {Book} from '../src/js/model.js';
let fail=0; const eq=(a,b,m)=>{ if(JSON.stringify(a)!==JSON.stringify(b)){fail++;console.log('FAIL',m,JSON.stringify(a),'!=',JSON.stringify(b));} };
const b=new Book();
const T=(a,r,c)=>b.display(b.sheet,r,c).text;
b.setInput(b.sheet,0,0,'1'); b.setInput(b.sheet,1,0,'2'); b.setInput(b.sheet,2,0,'3'); b.setInput(b.sheet,3,0,'=SUM(A1:A3)');
eq(T(0,3,0),'6','sum');
b.setInput(b.sheet,0,1,'=A1*2'); eq(T(0,0,1),'2','mult');
// cycle
b.setInput(b.sheet,5,0,'=A7'); b.setInput(b.sheet,6,0,'=A6'); eq(T(0,5,0),'#CIRC!','circ');
b.clear(b.sheet,{r1:5,c1:0,r2:6,c2:0},'all');
// insert row at index 1 -> formulas adjust
b.insertLines(b.sheet,'row',1,1);
eq(b.rawInput(b.sheet,4,0),'=SUM(A1:A4)','insert adjusts range'); eq(T(0,4,0),'6','sum after insert');
b.undo(); eq(b.rawInput(b.sheet,3,0),'=SUM(A1:A3)','undo insert'); eq(T(0,3,0),'6','undo value');
b.redo(); eq(b.rawInput(b.sheet,4,0),'=SUM(A1:A4)','redo');
b.undo();
// delete row index 0 (cell A1) -> =A1*2 in B1 becomes #REF!
b.deleteLines(b.sheet,'row',0,1); eq(T(0,0,1),'','B1 moved away'); eq(b.rawInput(b.sheet,-0,0),'2','A1 now 2'); 
b.undo();
// date + percent typed
b.setInput(b.sheet,8,0,'2023-03-15'); eq(T(0,8,0),'2023-03-15','date typed'); b.setInput(b.sheet,9,0,'12%'); eq(T(0,9,0),'12%','pct typed');
eq(b.rawInput(b.sheet,9,0),'12%','pct raw');
b.setInput(b.sheet,10,0,"'123"); eq(b.get(b.sheet,10,0).v,'123','text prefix'); eq(b.rawInput(b.sheet,10,0),"'123",'text raw keeps quote');
// copy/paste with relative formula
const p=b.copyPayload(b.sheet,{r1:0,c1:1,r2:0,c2:1}); b.pasteCells(b.sheet,{r1:1,c1:1,r2:1,c2:1},p);
eq(b.rawInput(b.sheet,1,1),'=A2*2','paste shifts formula'); eq(T(0,1,1),'4','paste value');
// paste tile
b.pasteCells(b.sheet,{r1:2,c1:1,r2:3,c2:1},p); eq(b.rawInput(b.sheet,3,1),'=A4*2','tile');
// fill down series
const f=new Book(); const fs=f.sheet; f.setInput(fs,0,0,'1'); f.setInput(fs,1,0,'2'); f.fill(fs,{r1:0,c1:0,r2:1,c2:0},{r1:0,c1:0,r2:5,c2:0});
eq([0,1,2,3,4,5].map(r=>f.value(fs,r,0)),[1,2,3,4,5,6],'linear fill');
f.setInput(fs,0,2,'Item 1'); f.fill(fs,{r1:0,c1:2,r2:0,c2:2},{r1:0,c1:2,r2:3,c2:2}); eq([0,1,2,3].map(r=>f.value(fs,r,2)),['Item 1','Item 2','Item 3','Item 4'],'text series');
f.setInput(fs,0,3,'=A1+1'); f.fill(fs,{r1:0,c1:3,r2:0,c2:3},{r1:0,c1:3,r2:2,c2:3}); eq(f.rawInput(fs,2,3),'=A3+1','formula fill');
f.fill(fs,{r1:2,c1:0,r2:3,c2:0},{r1:0,c1:0,r2:3,c2:0}); eq(f.value(fs,0,0),1,'fill up keeps'); 
// sort
const g=new Book(); const gs=g.sheet; ['b','a','c'].forEach((v,i)=>{g.setInput(gs,i+1,0,v); g.setInput(gs,i+1,1,String(i+1));}); g.setInput(gs,0,0,'Name'); g.setInput(gs,0,1,'N');
g.sort(gs,{r1:0,c1:0,r2:3,c2:1},0,true,true); eq([1,2,3].map(r=>g.value(gs,r,0)),['a','b','c'],'sort asc'); eq([1,2,3].map(r=>g.value(gs,r,1)),[2,1,3],'sort moves rows'); eq(g.value(gs,0,0),'Name','header kept');
g.sort(gs,{r1:0,c1:0,r2:3,c2:1},1,false,true); eq([1,2,3].map(r=>g.value(gs,r,1)),[3,2,1],'sort desc');
// sheets, rename updates formulas
const h=new Book(); h.addSheet('Data'); const d=h.sheets[1]; h.setInput(d,0,0,'5'); h.active=0; h.setInput(h.sheets[0],0,0,'=Data!A1*2'); eq(h.value(h.sheets[0],0,0),10,'xsheet');
h.renameSheet(1,'My Data'); eq(h.rawInput(h.sheets[0],0,0),"='My Data'!A1*2",'rename rewrites'); eq(h.value(h.sheets[0],0,0),10,'rename value');
h.deleteSheet(1); eq(h.display(h.sheets[0],0,0).text,'#REF!','delete sheet #REF');
// merge + styles
const m=new Book(); const ms=m.sheet; m.setInput(ms,0,0,'x'); m.setInput(ms,0,1,'y'); m.merge(ms,{r1:0,c1:0,r2:1,c2:1}); eq(m.get(ms,0,1),undefined,'merge clears'); eq(!!m.mergeAt(ms,1,1),true,'mergeAt');
m.applyStyle(ms,{r1:0,c1:0,r2:0,c2:0},{b:true,fc:'#ff0000'}); eq(m.styleOf(m.get(ms,0,0)),{b:true,fc:'#ff0000'},'style'); m.applyBorder(ms,{r1:3,c1:3,r2:4,c2:4},'outer'); eq(m.styleOf(m.get(ms,3,3)).bT&&m.styleOf(m.get(ms,3,3)).bL?1:0,1,'border outer'); eq(m.styleOf(m.get(ms,4,4)).bB?1:0,1,'border outer 2');
// filter
const q=new Book(); const qs=q.sheet; ['h','a','b','a'].forEach((v,i)=>q.setInput(qs,i,0,v)); q.setFilter(qs,{r1:0,c1:0,r2:3,c2:0}); q.applyFilter(qs,{0:new Set(['a'])}); eq([...qs.hidden],[1,3],'filter hides');
// stats
eq(b.stats(b.sheet,{r1:0,c1:0,r2:2,c2:0}).sum,6,'stats'); 
console.log(fail?('FAILURES '+fail):'model: all passed');
