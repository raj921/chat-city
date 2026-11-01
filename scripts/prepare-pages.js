import { cp, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { exportCity } from './export.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const result=await exportCity();
await mkdir(new URL('../docs/',import.meta.url),{recursive:true});
await cp(result.outDir,root+'docs',{recursive:true});
await writeFile(root+'docs/.nojekyll','');
console.log(`Prepared ${result.count} validated buildings for GitHub Pages in docs/`);
