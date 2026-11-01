import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = process.cwd();
const repository = 'https://github.com/hanwanyin/LLM-history-buildings.git';
const checkout = path.resolve('work/pages-publish');
const build = path.resolve('outputs/github-pages');
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
function git(args, cwd = root) {
  return execFileSync('git', [...(proxy ? ['-c', 'http.proxy=' + proxy] : []), ...args], { cwd, encoding:'utf8', env:{...process.env,GIT_TERMINAL_PROMPT:'0'}, stdio:['pipe','pipe','pipe'] }).trim();
}
if (git(['status','--porcelain'])) throw Error('Commit source changes before publishing.');
const sourceCommit = git(['rev-parse','HEAD']);
if (!git(['ls-remote',repository,'refs/heads/main']).startsWith(sourceCommit)) throw Error('Push this source commit to main before publishing.');
await fs.access(path.join(build,'index.html'));
const snapshot = JSON.parse(await fs.readFile(path.join(build,'snapshot/manifest.json'),'utf8'));
const remoteHead = git(['ls-remote',repository,'refs/heads/gh-pages']).split(/\s/)[0];
try { await fs.access(path.join(checkout,'.git')); }
catch {
  await fs.mkdir(path.dirname(checkout),{recursive:true});
  if (remoteHead) git(['clone','--single-branch','--branch','gh-pages',repository,checkout]);
  else { await fs.mkdir(checkout,{recursive:true}); git(['init','-b','gh-pages'],checkout); }
}
if (remoteHead) {
  git(['fetch',repository,'gh-pages'],checkout);
  git(['merge','--ff-only','FETCH_HEAD'],checkout);
  const marker = JSON.parse(await fs.readFile(path.join(checkout,'.heritage-pages.json'),'utf8'));
  if (marker.generated_by !== 'heritage-pages-publisher') throw Error('The branch is not a generated heritage Pages branch.');
}
// This checkout is reserved for generated public output; source and live data
// remain in main and the original database. No force pushes are used.
for (const name of await fs.readdir(checkout)) if (name !== '.git') await fs.rm(path.join(checkout,name),{recursive:true,force:true});
await fs.cp(build,checkout,{recursive:true,filter:file=>!path.basename(file).startsWith('._')&&!['.DS_Store','.git'].includes(path.basename(file))});
await fs.writeFile(path.join(checkout,'.gitignore'),'._*\n.DS_Store\n');
await fs.writeFile(path.join(checkout,'.heritage-pages.json'),JSON.stringify({generated_by:'heritage-pages-publisher',source_commit:sourceCommit,snapshot},null,2));
git(['add','--all'],checkout);
if (git(['status','--porcelain'],checkout)) git(['commit','-m','Publish public heritage snapshot '+snapshot.exported_at],checkout);
git(['push',repository,'HEAD:refs/heads/gh-pages'],checkout);
// Reuse the user's existing Git credential helper in memory only. Credentials
// are never stored in generated files, arguments, output, or Git remotes.
const raw = execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0'},stdio:['pipe','pipe','pipe']});
const credential = Object.fromEntries(raw.trim().split('\n').map(line=>{const index=line.indexOf('=');return [line.slice(0,index),line.slice(index+1)];}));
async function api(method='GET',body) {
  const response = await fetch('https://api.github.com/repos/hanwanyin/LLM-history-buildings/pages',{method,headers:{Authorization:'Bearer '+credential.password,Accept:'application/vnd.github+json',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
  const data = await response.json().catch(()=>({}));
  return {status:response.status,data};
}
let pages = await api();
if (pages.status === 404) pages = await api('POST',{build_type:'legacy',source:{branch:'gh-pages',path:'/'}});
if (![200,201].includes(pages.status)) throw Error('Pages configuration failed: HTTP '+pages.status+' '+(pages.data.message||''));
if (pages.data.source?.branch !== 'gh-pages' || pages.data.source?.path !== '/') throw Error('Pages has another source configured; review before changing it.');
console.log(JSON.stringify({published_commit:git(['rev-parse','HEAD'],checkout),source_commit:sourceCommit,pages_url:pages.data.html_url,build_status:pages.data.status,exported_at:snapshot.exported_at}));
