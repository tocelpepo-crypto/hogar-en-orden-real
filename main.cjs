const {app,BrowserWindow,Menu,ipcMain,shell,dialog}=require('electron');
const path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {execFile,spawn}=require('node:child_process');
app.setName('Hone Optimizador');
const backupPath=()=>path.join(app.getPath('userData'),'windows-settings-backup.json');
const GAMEBAR='HKCU\\Software\\Microsoft\\GameBar';
const MODE={key:GAMEBAR,name:'AutoGameModeEnabled',type:'REG_DWORD'};
const CONTROLLER={key:GAMEBAR,name:'UseNexusForGameBarEnabled',type:'REG_DWORD'};
const CAPTURES=[{key:'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR',name:'AppCaptureEnabled',type:'REG_DWORD'},{key:'HKCU\\System\\GameConfigStore',name:'GameDVR_Enabled',type:'REG_DWORD'}];
const GPU='HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences';
const RUN='HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
function exec(program,args){return new Promise((resolve,reject)=>execFile(program,args,{windowsHide:true,encoding:'utf8'},(err,out,stderr)=>err?reject(new Error((stderr||out||err.message).trim())):resolve((out||'').trim())))}
const reg=args=>exec('reg.exe',args), id=x=>`${x.key}\\${x.name}`;
async function readReg(x){try{const out=await reg(['query',x.key,'/v',x.name]);const line=out.split(/\r?\n/).find(y=>y.trim().startsWith(x.name));const m=line?.trim().match(/^(.+?)\s+(REG_\S+)\s+(.+)$/);return m?{exists:true,type:m[2],data:m[3].trim()}:{exists:false}}catch{return{exists:false}}}
async function getBackup(){try{return{values:{},...JSON.parse(await fs.readFile(backupPath(),'utf8'))}}catch{return{values:{}}}}
async function saveBackup(b){await fs.mkdir(path.dirname(backupPath()),{recursive:true});await fs.writeFile(backupPath(),JSON.stringify(b,null,2),'utf8')}
async function remember(x){const b=await getBackup(),k=id(x);if(!Object.hasOwn(b.values,k)){b.values[k]={item:x,original:await readReg(x)};await saveBackup(b)}}
async function put(x,val){await reg(['add',x.key,'/v',x.name,'/t',x.type,'/d',String(val),'/f'])}
async function restoreRecord(b,k){const e=b.values[k];if(!e)return;if(e.original.exists)await reg(['add',e.item.key,'/v',e.item.name,'/t',e.original.type,'/d',e.original.data,'/f']);else try{await reg(['delete',e.item.key,'/v',e.item.name,'/f'])}catch{}delete b.values[k]}
const dword=(x,n)=>x.exists&&(x.data.toLowerCase()==='0x'+n.toString(16)||x.data===String(n));
async function startupList(){let out='';try{out=await reg(['query',RUN])}catch{return[]}const rows=[];for(const line of out.split(/\r?\n/)){const m=line.match(/^\s+(.+?)\s+(REG_\w+)\s+(.*)$/);if(m)rows.push({name:m[1].trim(),data:m[3].trim(),disabled:false})}const b=await getBackup(),map=new Map(rows.map(x=>[x.name,x]));for(const e of Object.values(b.values))if(e.item.key===RUN&&e.original.exists&&!map.has(e.item.name))map.set(e.item.name,{name:e.item.name,data:e.original.data,disabled:true});return[...map.values()].sort((a,b)=>a.name.localeCompare(b.name))}
async function activeGuid(){const s=await exec('powercfg.exe',['/getactivescheme']);return s.match(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i)?.[0]||null}
async function powerOn(){const guid=await activeGuid().catch(()=>''),plans=await exec('powercfg.exe',['/list']).catch(()=>''),line=plans.split(/\r?\n/).find(x=>x.includes(guid)&&x.includes('*'))||'';return guid.toLowerCase()==='8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'||/high performance|alto rendimiento/i.test(line)}
function windows(){if(process.platform!=='win32')throw new Error('Esta función requiere Windows 10 u 11.')}
async function status(){const [m,c,...cap]=await Promise.all([readReg(MODE),readReg(CONTROLLER),...CAPTURES.map(readReg)]),b=await getBackup();return{windows:process.platform==='win32',gameMode:m.exists?dword(m,1):null,controller:c.exists?dword(c,1):null,captures:cap.length>0&&cap.every(x=>dword(x,0)),power:await powerOn().catch(()=>false),hasChanges:Object.keys(b.values).length>0||Boolean(b.powerGuid),startup:await startupList(),gpu:Object.values(b.values).filter(e=>e.item.key===GPU).map(e=>({path:e.item.name,name:path.basename(e.item.name)}))}}
ipcMain.handle('o:status',status);
ipcMain.handle('o:mode',async(_,on)=>{windows();await remember(MODE);await put(MODE,on?1:0);return status()});
ipcMain.handle('o:capture',async(_,on)=>{windows();for(const x of CAPTURES)await remember(x);if(on)for(const x of CAPTURES)await put(x,0);else{const b=await getBackup();for(const x of CAPTURES)await restoreRecord(b,id(x));await saveBackup(b)}return status()});
ipcMain.handle('o:controller',async(_,on)=>{windows();if(on){await remember(CONTROLLER);await put(CONTROLLER,0)}else{const b=await getBackup();await restoreRecord(b,id(CONTROLLER));await saveBackup(b)}return status()});
ipcMain.handle('o:power',async(_,on)=>{windows();const b=await getBackup();if(on){if(!b.powerGuid){b.powerGuid=await activeGuid();await saveBackup(b)}await exec('powercfg.exe',['/setactive','SCHEME_MIN'])}else if(b.powerGuid){await exec('powercfg.exe',['/setactive',b.powerGuid]);delete b.powerGuid;await saveBackup(b)}return status()});
ipcMain.handle('o:startup',async(_,name,off)=>{windows();if(typeof name!=='string'||!name||name.length>256)throw Error('Nombre de inicio no válido.');const x={key:RUN,name,type:'REG_SZ'};if(off){await remember(x);await reg(['delete',RUN,'/v',name,'/f'])}else{const b=await getBackup();await restoreRecord(b,id(x));await saveBackup(b)}return status()});
ipcMain.handle('o:choose',async()=>{const r=await dialog.showOpenDialog({title:'Selecciona el ejecutable del juego',properties:['openFile'],filters:[{name:'Aplicaciones Windows',extensions:['exe']}]});return r.canceled?null:r.filePaths[0]});
ipcMain.handle('o:gpu',async(_,file,on)=>{windows();if(typeof file!=='string'||!path.isAbsolute(file)||!file.toLowerCase().endsWith('.exe'))throw Error('Selecciona un archivo .exe válido.');const x={key:GPU,name:file,type:'REG_SZ'};if(on){await remember(x);await put(x,'GpuPreference=2;')}else{const b=await getBackup();await restoreRecord(b,id(x));await saveBackup(b)}return status()});
ipcMain.handle('o:boost',async(_,file)=>{windows();if(typeof file!=='string'||!path.isAbsolute(file)||!file.toLowerCase().endsWith('.exe'))throw Error('Selecciona un archivo .exe válido.');return new Promise((resolve,reject)=>{const child=spawn(file,[],{windowsHide:false,stdio:'ignore'});child.once('error',e=>reject(new Error('No se pudo abrir: '+e.message)));child.once('spawn',()=>setTimeout(()=>{try{os.setPriority(child.pid,-7);resolve({name:path.basename(file),pid:child.pid})}catch(e){resolve({name:path.basename(file),pid:child.pid,note:'El juego abrió, pero Windows no permitió cambiar prioridad.'})}},400))})});
ipcMain.handle('o:dns',async()=>{windows();return exec('ipconfig.exe',['/flushdns'])});
ipcMain.handle('o:restore',async()=>{windows();const b=await getBackup();for(const k of Object.keys(b.values))await restoreRecord(b,k);if(b.powerGuid)await exec('powercfg.exe',['/setactive',b.powerGuid]);await fs.rm(backupPath(),{force:true});return status()});
ipcMain.handle('o:settings',(_,uri)=>shell.openExternal(uri==='graphics'?'ms-settings:display-advancedgraphics':'ms-settings:gaming-gamemode'));
function create(){const w=new BrowserWindow({width:1120,height:850,minWidth:820,minHeight:650,backgroundColor:'#111014',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});Menu.setApplicationMenu(null);w.loadFile(path.join(__dirname,'index.html'))}
app.whenReady().then(()=>{create();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)create()})});app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});

