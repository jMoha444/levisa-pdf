import type { ToolId } from '../types';
export type InputFile = { name: string; bytes: Uint8Array };
export type Mark = { id: string; page: number; x: number; y: number; w: number; h: number; kind: 'text' | 'image' | 'redact' | 'crop' | 'field' | 'checkbox'; text: string; size: number; color: string; image?: Uint8Array };
export type Field = { name: string; type: 'text' | 'check' | 'select' | 'unsupported'; value: string; options?: string[]; readOnly: boolean };
export type AdvancedOptions = { range: string; text: string; size: number; color: string; opacity: number; start: number; position: string; password: string; confirm: string; language: string; scale: number; marks: Mark[]; fields: Field[]; flatten: boolean; allPages: boolean; scanMode: string; scanRotation: number; scanMargin: number; threshold: number };
export const defaultOptions: AdvancedOptions = {range:'',text:'CONFIDENTIEL',size:18,color:'#242139',opacity:0.22,start:1,position:'bottom-center',password:'',confirm:'',language:'fra',scale:1.5,marks:[],fields:[],flatten:false,allPages:false,scanMode:'color',scanRotation:0,scanMargin:0,threshold:25};
export type AdvancedJob = { tool: ToolId; files: InputFile[]; options: AdvancedOptions };
export type Progress = (percent: number, message?: string) => void;
export function checkAbort(signal?: AbortSignal) { if(signal?.aborted) throw new Error('Opération annulée.'); }
export function pause(signal?: AbortSignal) { checkAbort(signal); return new Promise<void>(r=>setTimeout(r,0)); }
