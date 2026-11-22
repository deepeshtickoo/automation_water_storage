// Lists the built files so the Node-RED installer knows what to download into /share/water-web.
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const root = new URL('../../public/', import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [relative(root, join(d, f))]));
const files = walk(root).filter((f) => f !== 'manifest.json').sort();
writeFileSync(join(root, 'manifest.json'), JSON.stringify({ app: 'water-api', version: process.env.npm_package_version, files }, null, 2) + '\n');
console.log(`manifest: ${files.length} files`);
