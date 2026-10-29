import type { Machine, Preferences, Session } from '@/domain/model';
import { runMachine } from '@/domain/turing';

export type AnalysisRequest = {
   machine: Machine;
   input: string;
   preferences: Preferences;
   maxSteps: number;
   maxConfigurations: number;
};

export type AnalysisResponse = { status: 'ready'; session: Session } | { status: 'error' };

globalThis.onmessage = (event: MessageEvent<AnalysisRequest>) => {
   const { machine, input, preferences, maxSteps, maxConfigurations } = event.data;
   try {
      const session = runMachine(machine, input, preferences, maxSteps, maxConfigurations);
      globalThis.postMessage({ status: 'ready', session } satisfies AnalysisResponse);
   } catch {
      globalThis.postMessage({ status: 'error' } satisfies AnalysisResponse);
   }
};
