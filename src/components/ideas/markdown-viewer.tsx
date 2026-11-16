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
    <div className="prose-studio text-sm leading-relaxed text-zinc-200 space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-4 text-xl font-bold text-zinc-100">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-4 border-b border-[#1f2735] pb-1 text-lg font-semibold text-zinc-100">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 text-base font-semibold text-amber-300">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="text-zinc-300">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5 text-zinc-300">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5 text-zinc-300">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 underline decoration-cyan-500/40 underline-offset-2 hover:text-cyan-300"
            >
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            const isBlock = Boolean(className);
            return isBlock ? (
              <code className="block overflow-x-auto rounded-lg border border-[#1f2735] bg-[#080a0f] p-3 font-mono text-xs text-amber-200">
                {children}
              </code>
            ) : (
              <code className="rounded bg-[#1a2232] px-1.5 py-0.5 font-mono text-xs text-amber-300">
                {children}
              </code>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-amber-500/60 pl-3 italic text-zinc-400">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-[#1f2735] text-xs">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-[#1f2735] bg-[#141a26] px-3 py-2 text-left font-semibold text-zinc-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-[#1f2735] px-3 py-2 text-zinc-300">
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
