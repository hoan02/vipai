import { getMarkdown, parseMarkdownToStructure } from "stream-markdown-parser";
const md = getMarkdown();
const src = "## Hi\n\nThis is **bold** and `code` and a [link](https://x.com).\n\n- one\n- two\n\n```js\nconst a = 1;\n```\n";
const nodes = parseMarkdownToStructure(src, md, { final: true, streamParse: false });
console.log(JSON.stringify(nodes, null, 1).slice(0, 4000));
