"use client";

import { Fragment, useMemo, type CSSProperties, type ReactNode } from "react";
import {
  getMarkdown,
  parseMarkdownToStructure,
  type ParsedNode,
} from "stream-markdown-parser";

/**
 * Markdown for chat replies.
 *
 * The parser (stream-markdown-parser) is asked for an AST and this file
 * turns that AST into real React elements. Nothing is sent through
 * `dangerouslySetInnerHTML`, so a reply can never smuggle markup into the
 * page — the worst a model can do is style its own text.
 *
 * While a reply is still streaming the parse runs in streaming mode
 * (`final: false`), which keeps half-typed constructs — an unclosed fence,
 * a dangling `**` — from flashing as broken output, and a caret is drawn
 * after the last node.
 */

// One shared instance; the parser is stateful only for `streamParse: auto`
// and holds no per-render data.
const md = getMarkdown();

/** A permissive shape covering every node the parser may emit. */
type Node = {
  type: string;
  raw?: string;
  content?: string;
  children?: Node[];
  level?: number;
  ordered?: boolean;
  start?: number;
  items?: Node[];
  code?: string;
  language?: string;
  href?: string;
  title?: string | null;
  text?: string;
  alt?: string;
  src?: string;
  header?: Node | boolean;
  rows?: Node[];
  cells?: Node[];
  align?: string;
  name?: string;
  markup?: string;
  checked?: boolean;
};

function safeHref(href: string | undefined): string | null {
  if (!href) return null;
  const value = href.trim();
  if (/^(https?:|mailto:|\/|#)/i.test(value)) return value;
  return null;
}

function renderNodes(nodes: Node[] | undefined, prefix: string): ReactNode[] {
  if (!nodes || nodes.length === 0) return [];
  return nodes.map((node, index) => renderNode(node, `${prefix}.${index}`));
}

function renderNode(node: Node, key: string): ReactNode {
  const children = () => renderNodes(node.children, key);

  switch (node.type) {
    case "text":
      return <Fragment key={key}>{node.content ?? ""}</Fragment>;

    case "paragraph":
      return <p key={key}>{children()}</p>;

    case "heading": {
      const level = Math.min(6, Math.max(1, node.level ?? 1));
      const Tag = `h${level}` as "h1";
      return <Tag key={key}>{children()}</Tag>;
    }

    case "list": {
      const items = (node.items ?? []).map((item, i) =>
        renderNode({ ...item, type: "list_item" }, `${key}.${i}`),
      );
      return node.ordered ? (
        <ol key={key} start={node.start}>{items}</ol>
      ) : (
        <ul key={key}>{items}</ul>
      );
    }

    case "list_item":
      return <li key={key}>{children()}</li>;

    case "code_block":
      return (
        <pre key={key}>
          <code>{node.code ?? node.raw ?? ""}</code>
        </pre>
      );

    case "inline_code":
      return <code key={key}>{node.code ?? ""}</code>;

    case "link": {
      const href = safeHref(node.href);
      if (!href) return <Fragment key={key}>{node.text ?? children()}</Fragment>;
      return (
        <a key={key} href={href} target="_blank" rel="noreferrer noopener">
          {node.children && node.children.length > 0 ? children() : (node.text ?? href)}
        </a>
      );
    }

    case "image": {
      const src = safeHref(node.src);
      if (!src) return <Fragment key={key}>{node.alt ?? ""}</Fragment>;
      // eslint-disable-next-line @next/next/no-img-element
      return <img key={key} src={src} alt={node.alt ?? ""} loading="lazy" />;
    }

    case "thematic_break":
      return <hr key={key} />;

    case "blockquote":
      return <blockquote key={key}>{children()}</blockquote>;

    case "table":
      return (
        <table key={key}>
          {node.header && typeof node.header === "object" ? (
            <thead>{renderNode(node.header, `${key}.h`)}</thead>
          ) : null}
          <tbody>{(node.rows ?? []).map((row, i) => renderNode(row, `${key}.r${i}`))}</tbody>
        </table>
      );

    case "table_row":
      return <tr key={key}>{renderNodes(node.cells, key)}</tr>;

    case "table_cell": {
      const isHeader = node.header === true;
      const style: CSSProperties | undefined = node.align
        ? { textAlign: node.align as CSSProperties["textAlign"] }
        : undefined;
      return isHeader ? (
        <th key={key} style={style}>
          {children()}
        </th>
      ) : (
        <td key={key} style={style}>
          {children()}
        </td>
      );
    }

    case "strong":
      return <strong key={key}>{children()}</strong>;
    case "emphasis":
      return <em key={key}>{children()}</em>;
    case "strikethrough":
      return <del key={key}>{children()}</del>;
    case "highlight":
      return <mark key={key}>{children()}</mark>;
    case "insert":
      return <ins key={key}>{children()}</ins>;
    case "subscript":
      return <sub key={key}>{children()}</sub>;
    case "superscript":
      return <sup key={key}>{children()}</sup>;
    case "hardbreak":
      return <br key={key} />;

    case "math_inline":
      return <code key={key}>{node.content ?? ""}</code>;
    case "math_block":
      return (
        <pre key={key}>
          <code>{node.content ?? ""}</code>
        </pre>
      );

    case "checkbox":
    case "checkbox_input":
      return <span key={key}>{node.checked ? "☑ " : "☐ "}</span>;

    case "emoji":
      return <Fragment key={key}>{node.markup ?? node.name ?? ""}</Fragment>;

    default:
      // html_block / html_inline and any unknown node render as plain text —
      // never as markup.
      return (
        <Fragment key={key}>
          {node.content ?? node.text ?? node.raw ?? children()}
        </Fragment>
      );
  }
}

export function Markdown({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  const nodes = useMemo<Node[]>(() => {
    if (!content.trim()) return [];
    try {
      return parseMarkdownToStructure(content, md, {
        final: !streaming,
        streamParse: streaming ? "auto" : false,
      }) as unknown as Node[];
    } catch {
      return [{ type: "paragraph", children: [{ type: "text", content }] }];
    }
  }, [content, streaming]);

  return (
    <div className="md">
      {renderNodes(nodes, "md")}
      {streaming ? <span className="md-caret" aria-hidden="true" /> : null}
    </div>
  );
}
