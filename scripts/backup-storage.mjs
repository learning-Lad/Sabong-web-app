import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,sep} from 'node:path'
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
if(!url||!key)throw new Error('Storage backup credentials are missing.')
const root=resolve(process.argv[2]||'backup/photos'),bucket='farm-bird-photos'
const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'}
async function walk(prefix=''){
  for(let offset=0;;offset+=1000){
    const response=await fetch(`${url}/storage/v1/object/list/${bucket}`,{method:'POST',headers,body:JSON.stringify({prefix,limit:1000,offset,sortBy:{column:'name',order:'asc'}}),signal:AbortSignal.timeout(60000)})
    if(!response.ok)throw new Error('Storage listing failed: '+response.status)
    const entries=await response.json()
    for(const entry of entries){
      if(!entry.name||entry.name==='.'||entry.name==='..'||entry.name.includes('/')||entry.name.includes('\\'))throw new Error('Invalid storage object name.')
      const name=prefix?prefix+'/'+entry.name:entry.name
      if(!entry.id){await walk(name);continue}
      const target=resolve(root,name);if(!target.startsWith(root+sep))throw new Error('Invalid object path.')
      const object=await fetch(`${url}/storage/v1/object/authenticated/${bucket}/${name.split('/').map(encodeURIComponent).join('/')}`,{headers,signal:AbortSignal.timeout(60000)})
      if(!object.ok)throw new Error('Storage download failed: '+object.status)
      await mkdir(resolve(target,'..'),{recursive:true});await writeFile(target,new Uint8Array(await object.arrayBuffer()))
    }
    if(entries.length<1000)break
  }
}
await mkdir(root,{recursive:true});await walk()
console.log('Private photo backup completed.')
