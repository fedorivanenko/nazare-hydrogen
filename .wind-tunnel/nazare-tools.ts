import {Type} from 'typebox';
import {compileCapabilityTask, expandEntity, findEntities, inspectEntity} from '../app/nazare/registry/agent';

function result(value: unknown) {
  return {content:[{type:'text' as const,text:JSON.stringify(value,null,2)}],details:{value}};
}

type ToolRegistrar = {registerTool(definition:unknown):void};

export default function registerNazareTools(pi: ToolRegistrar) {
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
