"use client";

import React from "react";
import { MDXRenderer } from "./mdx-renderer";

const sampleMDXContent = `# Welcome to MDX in Chat!

This is a **bold** statement and this is *italic* text.

## Code Examples

Here's some inline code: \`const hello = "world"\`

And here's a code block:

\`\`\`javascript
function greetUser(name) {
  return \`Hello, \${name}!\`;
}

console.log(greetUser("MDX"));
\`\`\`

## Lists

### Unordered List
- First item
- Second item with **bold text**
- Third item with [a link](https://example.com)

### Ordered List
1. First step
2. Second step
3. Third step

## Blockquote

> This is an important quote that stands out from the rest of the content.

## Horizontal Rule

---

## Strikethrough

This text has ~~strikethrough~~ formatting.

## Links

Check out [MDX documentation](https://mdxjs.com) for more information.

## Mixed Content

You can combine **bold**, *italic*, \`code\`, and [links](https://example.com) all in one paragraph!`;

export const MDXDemo: React.FC = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">MDX Demo</h2>
      <div className="border rounded-lg p-4 bg-background">
        <MDXRenderer content={sampleMDXContent} />
      </div>
    </div>
  );
};
