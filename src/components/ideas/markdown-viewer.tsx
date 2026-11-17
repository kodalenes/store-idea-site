"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownViewer({
  content,
  emptyText = "Henüz detaylı içerik eklenmemiş.",
}: {
  content: string;
  emptyText?: string;
}) {
  if (!content.trim()) {
    return <p className="text-sm italic text-zinc-500">{emptyText}</p>;
  }

  return (
    <div className="prose-studio text-sm leading-7 text-zinc-200 space-y-3.5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-5 text-2xl font-bold text-zinc-100">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-5 border-b border-[#243044] pb-1.5 text-lg font-semibold text-zinc-100">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3.5 text-base font-semibold text-amber-300">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="leading-7 text-zinc-200">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1.5 pl-5 text-zinc-200">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1.5 pl-5 text-zinc-200">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-7">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-300 underline decoration-cyan-400/50 underline-offset-2 hover:text-cyan-200"
            >
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            const isBlock = Boolean(className);
            return isBlock ? (
              <code className="block overflow-x-auto rounded-lg border border-[#243044] bg-[#0d121b] p-3.5 font-mono text-xs leading-relaxed text-amber-200">
                {children}
              </code>
            ) : (
              <code className="rounded bg-[#1b2436] px-1.5 py-0.5 font-mono text-xs text-amber-300">
                {children}
              </code>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-amber-500/70 pl-3.5 italic text-zinc-300">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-[#243044] text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-[#243044] bg-[#161e2c] px-3 py-2 text-left font-semibold text-zinc-100">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-[#243044] px-3 py-2 text-zinc-200">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
