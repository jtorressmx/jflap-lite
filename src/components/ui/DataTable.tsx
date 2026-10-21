import type { ComponentPropsWithRef, ReactNode } from 'react';

type Column = { id: string; header: ReactNode };

/**
 * Shows shared columns with rows supplied by each view.
 * @param props - Component options and native attributes for the rendered element.
 * @param props.columns - Ordered table columns.
 * @param props.columns[].id - Unique column identifier within the table.
 * @param props.columns[].header - Column header content.
 * @param [props.caption] - Accessible table title, visually hidden.
 * @param [props.children] - Result rows placed inside the table body.
 * @param [props.className] - Additional table classes.
 * @param [props.ref] - Optional native element reference.
 * @returns The table with semantic headers and supplied rows.
 */
export function DataTable({
   columns,
   caption,
   children,
   ...props
}: ComponentPropsWithRef<'table'> & {
   columns: readonly Column[];
   caption?: ReactNode;
}) {
   return (
      <table {...props}>
         {caption && <caption className="sr-only">{caption}</caption>}
         <thead>
            <tr>
               {columns.map((column) => (
                  <th key={column.id} scope="col">
                     {column.header}
                  </th>
               ))}
            </tr>
         </thead>
         <tbody>{children}</tbody>
      </table>
   );
}
