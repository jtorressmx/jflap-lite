import type { ComponentPropsWithRef } from 'react';
import { DataTable } from '../ui/DataTable';

const columns = [
  { id: 'input', header: 'Entrada' },
  { id: 'result', header: 'Resultado' },
  { id: 'output', header: 'Salida' },
  { id: 'steps', header: 'Pasos' },
  { id: 'detail', header: <span className="sr-only">Detalle</span> },
];

/**
 * Shows the shared test result columns.
 * @param props - Component options and native attributes for the rendered element.
 * @param [props.children] - Result rows placed inside the table body.
 * @param [props.className] - Additional table classes.
 * @param [props.ref] - Optional native element reference.
 * @returns The result table with its shared headers.
 */
export function BatchResultsTable(props: ComponentPropsWithRef<'table'>) {
  return <DataTable columns={columns} {...props} />;
}
