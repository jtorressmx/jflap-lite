import { useEffect, useRef, useState } from 'react';

import type { Session } from '@/domain/model';
import type { AnalysisRequest, AnalysisResponse } from '@/workers/turingAnalysis.worker';

type AnalysisState = {
   key: string;
   status: 'idle' | 'running' | 'ready' | 'error';
   session?: Session;
};

/** Analyzes a Turing input off the UI thread and discards outdated results.
 * @param request - Execution options.
 * @param request.machine - Machine whose transitions are analyzed.
 * @param request.input - Initial tape contents.
 * @param request.preferences - Acceptance and movement rules.
 * @param request.maxSteps - Highest iteration to inspect.
 * @param request.maxConfigurations - Maximum frontier width.
 * @param enabled - Whether this simulator is visible and should analyze.
 * @returns The current analysis status and its complete navigable session, when ready.
 */
export function useTuringAnalysis(request: AnalysisRequest, enabled: boolean) {
   const { machine, input, preferences, maxSteps, maxConfigurations } = request;
   const executionKey = JSON.stringify([
      machine.states.map(({ id, initial, final }) => [id, initial, final]),
      machine.transitions.map(({ id, from, to, read, write, move }) => [
         id,
         from,
         to,
         read,
         write,
         move,
      ]),
      input,
      preferences,
   ]);
   const key = JSON.stringify([executionKey, maxSteps, maxConfigurations]);
   const latest = useRef(request);
   latest.current = request;
   const available = enabled && machine.states.some((state) => state.initial);
   const [analysis, setAnalysis] = useState<AnalysisState>({ key: '', status: 'idle' });

   useEffect(() => {
      if (!available) return;
      let worker: Worker | undefined;
      const timeout = window.setTimeout(() => {
         setAnalysis({ key, status: 'running' });
         try {
            worker = new Worker(new URL('../workers/turingAnalysis.worker.ts', import.meta.url), {
               type: 'module',
            });
            worker.onmessage = (event: MessageEvent<AnalysisResponse>) => {
               const response = event.data;
               setAnalysis(
                  response.status === 'ready'
                     ? { key, status: 'ready', session: response.session }
                     : { key, status: 'error' }
               );
               worker?.terminate();
            };
            worker.onerror = () => {
               setAnalysis({ key, status: 'error' });
               worker?.terminate();
            };
            worker.postMessage(latest.current);
         } catch {
            worker?.terminate();
            setAnalysis({ key, status: 'error' });
         }
      }, 200);
      return () => {
         window.clearTimeout(timeout);
         worker?.terminate();
      };
   }, [key, available]);

   return {
      key,
      executionKey,
      status: !available ? 'idle' : analysis.key === key ? analysis.status : 'running',
      session: available && analysis.key === key ? analysis.session : undefined,
   };
}
