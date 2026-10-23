import type { useWorkspace } from '@/hooks/useWorkspace';

export type Workspace = ReturnType<typeof useWorkspace>;
export type Notify = (message: string) => void;
export type AppView = 'home' | 'document' | 'settings';
export type Tool = 'select' | 'state' | 'transition' | 'delete' | 'note';
export type Dialog =
   | { type: 'state'; id: string }
   | { type: 'transition'; id?: string; from?: string; to?: string }
   | { type: 'note'; id: string }
   | { type: 'rename-document'; id: string; name: string }
   | {
        type:
           | 'help'
           | 'special-functions'
           | 'manual-code'
           | 'about'
           | 'equivalence'
           | 'combine'
           | 'close'
           | 'close-all'
           | 'export'
           | 'license';
     };
export type ShowDialog = (dialog: Dialog | null) => void;
export type SimulationAction =
   'open' | 'start' | 'step' | 'fast' | 'batch' | 'output' | 'trace' | 'closure' | 'state';
