import { Fragment, ReactNode } from "react";

/**
 * Renders the small markdown subset myscheme uses (paragraphs, numbered and bulleted
 * lists, headings, **bold**, links). Builds React elements, never raw HTML, so scraped
 * text cannot inject markup.
 */

/** myscheme text carries HTML entities, sometimes double-escaped ("&amp;amp;"). */
function decode(s: string): string {
  let out = s;
  for (let i = 0; i < 3 && out.includes("&amp;"); i++) out = out.replace(/&amp;/g, "&");
  return out
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// Unpaired ** left over when bold spans a line break or a link.
const plain = (s: string) => s.replace(/\*\*/g, "");

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()*]+[^\s<>().,;:*])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(plain(text.slice(last, m.index)));
    const key = `${keyBase}-${i++}`;
    if (m[1]) out.push(<strong key={key}>{plain(m[1])}</strong>);
    else if (m[2]) out.push(<a key={key} href={m[3]} target="_blank" rel="noreferrer">{m[2]}</a>);
    else if (m[4]) out.push(<a key={key} href={m[4]} target="_blank" rel="noreferrer">{m[4]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(plain(text.slice(last)));
  return out;
}

export default function Markdown({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  const lines = decode(
    text
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trimEnd());

  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      const k = `p${blocks.length}`;
      blocks.push(<p key={k}>{inline(para.join(" "), k)}</p>);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const k = `l${blocks.length}`;
      const items = list.items.map((it, i) => <li key={`${k}-${i}`}>{inline(it, `${k}-${i}`)}</li>);
      blocks.push(list.ordered ? <ol key={k}>{items}</ol> : <ul key={k}>{items}</ul>);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const ordered = line.match(/^\d+[.)]\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (heading) {
      flushPara();
      flushList();
      const k = `h${blocks.length}`;
      blocks.push(<h4 key={k}>{inline(heading[1], k)}</h4>);
    } else if (ordered || bullet) {
      flushPara();
      const isOrdered = !!ordered;
      if (list && list.ordered !== isOrdered) flushList();
      if (!list) list = { ordered: isOrdered, items: [] };
      list.items.push((ordered ?? bullet)![1]);
    } else if (list && /^\s{2,}/.test(raw)) {
      list.items[list.items.length - 1] += ` ${line}`;
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return <div className="hq-prose">{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
