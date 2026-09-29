/** Response headers, one 30px row each: name | value. */
export function HeadersTable({ headers }: { headers: [string, string][] }) {
  return (
    <table className="w-full table-fixed border-collapse font-mono text-[12.5px]">
      <tbody>
        {headers.map(([k, v], i) => (
          <tr key={`${k}-${i}`}>
            <td className="h-[30px] w-2/5 truncate border-r border-b border-line px-3 text-fg" title={k}>
              {k}
            </td>
            <td className="h-[30px] truncate border-b border-line px-3 text-fg2" title={v}>
              {v}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
