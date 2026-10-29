import { FiCpu, FiGitBranch } from '@/components/icons';
import type { MachineKind } from '@/domain/model';

/**
 * Shows the shared icon for a machine kind.
 * @param props - Component options.
 * @param props.kind - Machine kind to represent.
 * @returns The icon for the machine kind.
 */
export function MachineKindIcon({ kind }: { kind: MachineKind }) {
   const Icon = kind === 'fa' ? FiGitBranch : FiCpu;
   return <Icon aria-hidden="true" />;
}
