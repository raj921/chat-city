import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const file=fileURLToPath(new URL('../city/usage.log',import.meta.url));
let lines;
try{lines=(await readFile(file,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}
catch(error){if(error.code==='ENOENT'){console.log('No runtime Codex builds measured yet.');process.exit(0);}throw error;}
const times=lines.filter(row=>row.type==='build.completed').map(row=>row.durationMs/1000).sort((a,b)=>a-b);
const failed=lines.filter(row=>row.type==='build.failed').length;
if(!times.length)console.log(`No completed builds; ${failed} failed jobs recorded.`);
else{
const n=times.length,median=n%2?times[(n-1)/2]:(times[n/2-1]+times[n/2])/2;
console.log(JSON.stringify({completed:n,failed,minSeconds:times[0],medianSeconds:median,maxSeconds:times.at(-1),meanSeconds:times.reduce((a,b)=>a+b,0)/n,sampleWarning:n<5?'Small sample; do not treat as a performance guarantee':undefined},null,2));
}
