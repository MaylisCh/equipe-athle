import { cp, mkdir, rm } from 'node:fs/promises';

const output = new URL('./dist/', import.meta.url);
await rm(output, {recursive:true,force:true});
await mkdir(output, {recursive:true});
for (const file of ['index.html','app.js','core.mjs','season.mjs','style.css','layout.css','calendar.css','manifest.webmanifest','service-worker.js','icon.svg']) {
 await cp(new URL(`./${file}`, import.meta.url), new URL(`./dist/${file}`, import.meta.url));
}
