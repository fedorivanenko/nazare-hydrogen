import {spawnSync} from 'node:child_process';
import {Type} from 'typebox';
import {compileCapabilityTask, expandEntity, findEntities, inspectEntity} from '../app/nazare/registry/agent';

function result(value: unknown) {
  return {content:[{type:'text' as const,text:JSON.stringify(value,null,2)}],details:{value}};
}

type ToolRegistrar = {registerTool(definition:unknown):void};

export default function registerNazareTools(pi: ToolRegistrar) {
  pi.registerTool({
    name:'apply_patch',
    label:'Apply Patch',
    description:'Apply a valid unified diff to one or more repository files. Use this instead of invoking an apply_patch shell command or embedding diff markers in edit replacement text.',
    promptSnippet:'Use apply_patch for coordinated or multi-file edits; pass only a valid unified diff in patch',
    parameters:Type.Object({patch:Type.String({description:'Valid unified diff, including --- and +++ file headers and @@ hunks'})}),
    async execute(_toolCallId:string,params:{patch:string}){
      if(Buffer.byteLength(params.patch)>100_000)throw new Error('Patch exceeds 100000 bytes');
      const check=spawnSync('git',['apply','--check','--whitespace=nowarn','-'],{cwd:process.cwd(),input:params.patch,encoding:'utf8'});
      if(check.status!==0)return {content:[{type:'text' as const,text:`Patch rejected: ${check.stderr||check.stdout||`git apply --check exited ${check.status}`}`}],details:{applied:false,error:check.stderr||check.stdout},isError:true};
      const applied=spawnSync('git',['apply','--whitespace=nowarn','-'],{cwd:process.cwd(),input:params.patch,encoding:'utf8'});
      if(applied.status!==0)return {content:[{type:'text' as const,text:`Patch failed: ${applied.stderr||applied.stdout||`git apply exited ${applied.status}`}`}],details:{applied:false,error:applied.stderr||applied.stdout},isError:true};
      return {content:[{type:'text' as const,text:'Patch applied successfully.'}],details:{applied:true}};
    },
  });

  pi.registerTool({
    name:'nazare_find',
    label:'Nazare Find',
    description:'Search the pinned Nazare architecture registry for capabilities, surfaces, providers, and source boundaries.',
    promptSnippet:'Search the Nazare registry before broad repository exploration',
    parameters:Type.Object({
      query:Type.String({description:'Behavior, capability, surface, or provider to find'}),
      kind:Type.Optional(Type.String({description:'Optional registry kind: capability, carcass, or provider'})),
    }),
    async execute(_toolCallId:string,params:{query:string;kind?:string}){return result(findEntities(params.query,params.kind as 'capability'|'carcass'|'provider'|undefined));},
  });

  pi.registerTool({
    name:'nazare_inspect',
    label:'Nazare Inspect',
    description:'Inspect one registry entity or expand its directly connected executable neighborhood.',
    promptSnippet:'Inspect or expand a Nazare registry entity by exact ID',
    parameters:Type.Object({
      id:Type.String({description:'Exact registry entity ID'}),
      expand:Type.Optional(Type.Boolean({description:'Include directly connected entities and bindings'})),
    }),
    async execute(_toolCallId:string,params:{id:string;expand?:boolean}){return result(params.expand?expandEntity(params.id):inspectEntity(params.id));},
  });

  pi.registerTool({
    name:'nazare_compile',
    label:'Nazare Compile',
    description:'Compile a requested capability change into pinned source files, bindings, policies, evidence, and verification requirements.',
    promptSnippet:'Compile a capability change before editing implementation files',
    parameters:Type.Object({
      capabilityId:Type.String({description:'Exact capability ID'}),
      requestedChange:Type.String({description:'Requested behavior change'}),
    }),
    async execute(_toolCallId:string,params:{capabilityId:string;requestedChange:string}){return result(compileCapabilityTask(params.capabilityId,params.requestedChange));},
  });
}
