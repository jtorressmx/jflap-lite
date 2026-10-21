import type { useWorkspace } from '@/hooks/useWorkspace';

export type Workspace = ReturnType<typeof useWorkspace>;
export type Notify = (message: string) => void;
export type Tool = 'select' | 'state' | 'transition' | 'delete' | 'note';
export type Dialog =
   | { type: 'state'; id: string }
   | { type: 'transition'; id?: string; from?: string; to?: string }
   | { type: 'transition-rules'; id: string }
   | { type: 'note'; id: string }
   | {
        type:
           | 'settings'
           | 'help'
           | 'special-functions'
           | 'manual-code'
           | 'about'
           | 'equivalence'
           | 'combine'
           | 'close'
           | 'export'
           | 'license';
     };
export type ShowDialog = (dialog: Dialog | null) => void;
export type SimulationAction =
   'open' | 'start' | 'step' | 'fast' | 'batch' | 'output' | 'trace' | 'closure' | 'state';
