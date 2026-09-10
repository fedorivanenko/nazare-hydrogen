import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {applyPatchText} from './nazare-tools';

test('applies model-native update patches',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'nazare-patch-'));
  const file=path.join(root,'example.txt');
  await writeFile(file,'before\nkeep\nafter\n');
  try{
    const changed=await applyPatchText(root,'*** Begin Patch\n*** Update File: example.txt\n@@\n before\n keep\n-after\n+updated\n*** End Patch\n');
    assert.deepEqual(changed,['example.txt']);
    assert.equal(await readFile(file,'utf8'),'before\nkeep\nupdated\n');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('applies a uniquely matching hunk with shifted indentation',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'nazare-patch-'));
  const file=path.join(root,'example.txt');
  await writeFile(file,'section: [\n\t{\n\t\tname: "old",\n\t}\n]\n');
  try{
    await applyPatchText(root,'*** Begin Patch\n*** Update File: example.txt\n@@\n\tsection: [\n\t\t{\n-\t\t\tname: "old",\n+\t\t\tname: "new",\n\t\t}\n\t]\n*** End Patch');
    assert.equal(await readFile(file,'utf8'),'section: [\n\t{\n\t\tname: "new",\n\t}\n]\n');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('rejects paths outside repository',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'nazare-patch-'));
  try{await assert.rejects(()=>applyPatchText(root,'*** Begin Patch\n*** Add File: ../escape.txt\n+no\n*** End Patch'),/escapes repository/);}
  finally{await rm(root,{recursive:true,force:true});}
});
