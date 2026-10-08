import {parse,evaluate,XErr} from '../src/js/formula.js';
import {key,parseAddr} from '../src/js/refs.js';
// minimal fake workbook: sheets with Map(key->raw|formula string starting '=')
const mk=(name,obj)=>{const cells=new Map();for(const [a,v] of Object.entries(obj)){const p=parseAddr(a);cells.set(key(p.r,p.c),v);}return {name,cells};};
const S1=mk('Sheet1',{A1:1,A2:2,A3:3,A4:'x',B1:10,B2:20,B3:30,C1:'=A1+B1',D1:'apple',D2:'banana',D3:'apple',E1:5,E2:15,E3:25,F1:'k1',F2:'k2',F3:'k3',G1:100,G2:200,G3:300});
const S2=mk('My Sheet',{A1:42});
const sheets=[S1,S2];
const env={
  sheetByName:n=>sheets.find(s=>s.name.toLowerCase()===n.toLowerCase())||null,
  bounds:s=>{let R=-1,C=-1;for(const k of s.cells.keys()){R=Math.max(R,Math.floor(k/16384));C=Math.max(C,k%16384);}return {maxR:R,maxC:C};},
  eachInRange:(s,r1,c1,r2,c2,cb)=>{const b=env.bounds(s);for(let r=r1;r<=Math.min(r2,b.maxR);r++)for(let c=c1;c<=Math.min(c2,b.maxC);c++){const v=env.cellValue(s,r,c);if(v!==null)cb(v,r,c);}},
  cellValue:(s,r,c)=>{const v=s.cells.get(key(r,c));if(v===undefined)return null;if(typeof v==='string'&&v[0]==='=')return evaluate(parse(v.slice(1)),{env,sheet:s,r,c});return v;},
  now:()=>Date.UTC(2023,2,15,12,0,0),
};
let fail=0;
const t=(f,exp,sheet=S1,r=10,c=10)=>{let v=evaluate(parse(f),{env,sheet,r,c});if(v instanceof XErr)v=v.code;const ok=typeof exp==='number'&&typeof v==='number'?Math.abs(v-exp)<1e-9:v===exp;if(!ok){fail++;console.log('FAIL',f,'=>',JSON.stringify(v),'expected',JSON.stringify(exp));}};
t('1+2*3',7);t('-2^2',4);t('(1+2)*3',9);t('2^3^2',64);t('10%',0.1);t('"a"&"b"&1','ab1');t('1=1',true);t('"a"="A"',true);t('1<2',true);t('1/0','#DIV/0!');
t('SUM(A1:A3)',6);t('SUM(A1:A4)',6);t('SUM(A:A)',6);t('SUM(A1:A3,B1:B3,100)',166);t('AVERAGE(A1:A3)',2);t('MIN(A1:A3)',1);t('MAX(B1:B3)',30);
t('COUNT(A1:A4)',3);t('COUNTA(A1:A4)',4);t('COUNTBLANK(A1:A6)',2);t('MEDIAN(B1:B3)',20);
t('IF(A1>0,"pos","neg")','pos');t('IF(A1>5,1)',false);t('IFERROR(1/0,"err")','err');t('IFS(A1>5,"a",A1>0,"b")','b');t('SWITCH(2,1,"one",2,"two","other")','two');
t('AND(TRUE,A1=1)',true);t('OR(FALSE,A1=2)',false);t('NOT(FALSE)',true);
t('ROUND(2.5,0)',3);t('ROUND(-2.5,0)',-3);t('ROUND(3.14159,2)',3.14);t('ROUNDUP(3.141,2)',3.15);t('ROUNDDOWN(3.149,2)',3.14);t('INT(-1.5)',-2);t('MOD(-3,2)',1);t('POWER(2,10)',1024);t('SQRT(16)',4);t('SQRT(-1)','#NUM!');t('ABS(-4)',4);
t('LEN("hello")',5);t('LEFT("hello",2)','he');t('RIGHT("hello",3)','llo');t('MID("hello",2,3)','ell');t('UPPER("a")','A');t('PROPER("hello wORLD")','Hello World');t('TRIM("  a   b ")','a b');
t('FIND("l","hello")',3);t('SEARCH("L*O","hello")',3);t('SUBSTITUTE("a-b-c","-","+")','a+b+c');t('SUBSTITUTE("a-b-c","-","+",2)','a-b+c');t('TEXT(1234.5,"#,##0.00")','1,234.50');t('TEXT(0.25,"0%")','25%');t('VALUE("12")',12);t('CONCAT("a",1,"b")','a1b');t('TEXTJOIN("-",TRUE,"a","","b")','a-b');
t('SUMIF(D1:D3,"apple",E1:E3)',30);t('COUNTIF(D1:D3,"apple")',2);t('COUNTIF(A1:A3,">1")',2);t('COUNTIF(D1:D3,"a*")',2);t('AVERAGEIF(D1:D3,"apple",E1:E3)',15);t('SUMIFS(E1:E3,D1:D3,"apple",A1:A3,">1")',25);t('COUNTIFS(D1:D3,"apple",A1:A3,"<3")',1);
t('VLOOKUP("k2",F1:G3,2,FALSE)',200);t('VLOOKUP("zz",F1:G3,2,FALSE)','#N/A');t('INDEX(F1:G3,3,2)',300);t('MATCH("k3",F1:F3,0)',3);t('MATCH(25,E1:E3,1)',3);t('HLOOKUP(10,B1:C1,1,FALSE)',10);t('XLOOKUP("k1",F1:F3,G1:G3)',100);
t("'My Sheet'!A1+1",43);t("SUM('My Sheet'!A1:A5)",42);t('Nope!A1','#REF!');t('NOSUCH(1)','#NAME?');t('SUM(',"#NAME?");
t('C1',11);t('SUMPRODUCT(A1:A3,B1:B3)',140);t('ROW()',11);t('COLUMN(C5)',3);t('CHOOSE(2,"a","b")','b');t('ISNUMBER(A1)',true);t('ISBLANK(Z9)',true);t('ISERROR(1/0)',true);
t('YEAR(45000)',2023);t('MONTH(45000)',3);t('DAY(45000)',15);t('DATE(2023,3,15)',45000);t('WEEKDAY(45000)',4);t('EDATE(45000,1)',45031);t('EOMONTH(45000,0)',45016);t('DATEDIF(45000,45400,"D")',400);t('TODAY()',45000);
t('INDIRECT("A2")',2);t('LARGE(A1:A3,1)',3);t('SMALL(A1:A3,2)',2);t('STDEV(A1:A3)',1);t('RANK(2,A1:A3)',2);t('PRODUCT(A1:A3)',6);t('LOG10(1000)',3);t('LN(1)',0);t('FACT(5)',120);
t('"a"+1','#VALUE!');t('SUM("x")','#VALUE!');t('A1:A3','#VALUE!',S1,10,10);t('A1:A3',2,S1,1,10);
console.log(fail?('FAILURES '+fail):'formula: all passed');
