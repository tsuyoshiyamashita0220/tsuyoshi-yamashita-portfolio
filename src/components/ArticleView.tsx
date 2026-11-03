import type { LawArticle, LawItem, LawTable } from "@/types/law";

/** 条文を e-Gov 原文のまま表示する。文言の加工はしない */
export function ArticleView({ article }: { article: LawArticle }) {
  return (
    <div className="space-y-3">
      {article.caption && <p className="text-sm text-muted">{article.caption}</p>}
      <h2 className="text-lg font-bold">{article.title}</h2>
      {article.paragraphs.map((p) => (
        <div key={p.num} className="space-y-2">
          {p.caption && <p className="text-sm text-muted">{p.caption}</p>}
          <p>
            {p.numLabel && <span className="mr-2 font-semibold">{p.numLabel}</span>}
            {p.sentence}
          </p>
          {p.items && <ItemList items={p.items} />}
          {p.tables?.map((t, i) => <TableView key={i} table={t} />)}
        </div>
      ))}
    </div>
  );
}

function ItemList({ items }: { items: LawItem[] }) {
  return (
    <ul className="space-y-1 pl-4">
      {items.map((item, i) => (
        <li key={`${item.title}-${i}`}>
          <span className="mr-2 font-semibold">{item.title}</span>
          {item.sentence}
          {item.children && <ItemList items={item.children} />}
        </li>
      ))}
    </ul>
  );
}

function TableView({ table }: { table: LawTable }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {table.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="border border-line p-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
