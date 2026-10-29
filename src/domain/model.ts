export const BLANK = '□';

export interface State {
   id: string;
   name: string;
   label: string;
   x: number;
   y: number;
   initial: boolean;
   final: boolean;
}

export interface Transition {
   id: string;
   from: string;
   to: string;
   read: string;
   write: string;
   move: 'L' | 'R' | 'S';
   control?: { x: number; y: number };
}

export interface Note {
   id: string;
   text: string;
   x: number;
   y: number;
}
export interface Machine {
   kind?: 'turing' | 'fa';
   name: string;
   states: State[];
   transitions: Transition[];
   notes: Note[];
}
export type MachineKind = 'turing' | 'fa';
export function machineKind(machine: Machine): MachineKind {
   return machine.kind ?? 'turing';
}
export function machineTitle(machine: Machine): string {
   return machineKind(machine) === 'fa' ? 'Autómata finito' : 'Máquina de Turing';
}
export interface Preferences {
   acceptFinal: boolean;
   acceptHalt: boolean;
   allowStay: boolean;
   transitionsFromFinal: boolean;
}

export const defaultPreferences: Preferences = {
   acceptFinal: true,
   acceptHalt: false,
   allowStay: false,
   transitionsFromFinal: true,
};

export interface Configuration {
   id: string;
   state: string;
   tape: Record<number, string>;
   head: number;
   halted: boolean;
   /** Terminal branch marker; separate from the TM halt acceptance flag. */
   rejected?: boolean;
   variables: Record<string, string>;
   parentId?: string;
   transitionId?: string;
   depth: number;
}

export type SimulationLoop = {
   firstIteration: number;
   repeatedIteration: number;
   period: number;
};

type SessionStatus = 'ready' | 'running' | 'accepted' | 'rejected' | 'limit' | 'loop';
export interface Session {
   input: string;
   configurations: Configuration[];
   history: Configuration[][];
   steps: number;
   status: SessionStatus;
   mode: 'deterministic' | 'nondeterministic';
   selectedId?: string;
   nextId?: number;
   /** Frozen branches remain visible, but do not advance. */
   frozenIds?: string[];
   message?: string;
   loop?: SimulationLoop;
}

export function emptyMachine(name = 'Máquina sin título'): Machine {
   return { name, states: [], transitions: [], notes: [] };
}

export function nextStateId(machine: Machine): string {
   let id = 0;
   while (machine.states.some((state) => state.id === String(id))) id++;
   return String(id);
}

export function movementSymbol(move: Transition['move']): string {
   return move === 'L' ? '←' : move === 'R' ? '→' : '•';
}
