import Link from "next/link";
import type { CitedText } from "@/types/content";
import { lawRefHref, lawRefLabel } from "@/lib/content";

/** 解説文と、その根拠へのリンク */
export function CitedTextView({ value }: { value: CitedText }) {
  return (
    <span>
      {value.text}
      {value.lawRefs?.map((ref, i) => (
        <Link
          key={`l${i}`}
          href={lawRefHref(ref)}
          className="ml-1 whitespace-nowrap text-xs text-muted underline"
        >
          [{lawRefLabel(ref)}]
        </Link>
      ))}
      {value.sourceRefs?.map((s, i) => (
        <a
          key={`s${i}`}
          href={s.url}
          className="ml-1 whitespace-nowrap text-xs text-muted underline"
          rel="noopener noreferrer"
        >
          [{s.publisher}「{s.title}」]
        </a>
      ))}
    </span>
  );
}
