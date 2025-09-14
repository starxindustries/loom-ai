"use client";

import React from "react";
import { MDXProvider } from "@mdx-js/react";
import { compile, run } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";

interface MDXRendererProps {
  content: string;
  className?: string;
}

// Custom components for MDX with proper styling
const components = {
  h1: ({ children, ...props }: any) => (
    <h1 className="text-2xl font-bold mt-6 mb-4 text-foreground" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: any) => (
    <h2 className="text-xl font-semibold mt-5 mb-3 text-foreground" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: any) => (
    <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }: any) => (
    <h4 className="text-base font-semibold mt-3 mb-2 text-foreground" {...props}>
      {children}
    </h4>
  ),
  p: ({ children, ...props }: any) => (
    <p className="mb-2 text-foreground" {...props}>
      {children}
    </p>
  ),
  code: ({ children, className, ...props }: any) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="text-sm font-mono text-foreground" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }: any) => (
    <div className="my-4 rounded-lg overflow-hidden border">
      <pre className="bg-muted p-4 overflow-x-auto" {...props}>
        {children}
      </pre>
    </div>
  ),
  ul: ({ children, ...props }: any) => (
    <ul className="list-disc list-inside mb-3 space-y-1 ml-4" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="list-decimal list-inside mb-3 space-y-1 ml-4" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: any) => (
    <li className="text-sm" {...props}>
      {children}
    </li>
  ),
  blockquote: ({ children, ...props }: any) => (
    <blockquote className="border-l-4 border-muted-foreground pl-4 my-3 italic text-muted-foreground bg-muted/30 py-2 rounded-r-md" {...props}>
      {children}
    </blockquote>
  ),
  hr: ({ ...props }: any) => (
    <hr className="my-4 border-t border-border" {...props} />
  ),
  a: ({ children, href, ...props }: any) => (
    <a 
      href={href} 
      className="text-blue-500 hover:text-blue-600 underline transition-colors" 
      target="_blank" 
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  strong: ({ children, ...props }: any) => (
    <strong className="font-semibold text-foreground" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }: any) => (
    <em className="italic text-foreground" {...props}>
      {children}
    </em>
  ),
  del: ({ children, ...props }: any) => (
    <del className="line-through text-muted-foreground" {...props}>
      {children}
    </del>
  ),
};

export const MDXRenderer: React.FC<MDXRendererProps> = ({ content, className = "" }) => {
  const [Component, setComponent] = React.useState<React.ComponentType | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const compileMDX = async () => {
      try {
        setError(null);
        const code = await compile(content, {
          outputFormat: 'function-body',
          development: false,
        });
        const { default: MDXContent } = await run(code, runtime);
        setComponent(() => MDXContent);
      } catch (err) {
        console.error('MDX compilation error:', err);
        setError(err instanceof Error ? err.message : 'Failed to compile MDX');
        // Fallback to plain text if MDX compilation fails
        setComponent(() => ({ children }: any) => <div className="text-foreground">{content}</div>);
      }
    };

    compileMDX();
  }, [content]);

  if (error) {
    console.warn('MDX Error:', error);
  }

  if (!Component) {
    return (
      <div className={`prose prose-sm max-w-none text-foreground ${className}`}>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className={`prose prose-sm max-w-none text-foreground ${className}`}>
      <MDXProvider components={components}>
        <Component />
      </MDXProvider>
    </div>
  );
};
