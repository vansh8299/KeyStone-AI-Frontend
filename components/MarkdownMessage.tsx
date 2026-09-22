"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          img: ({ src, alt }) =>
            typeof src === "string" && src ? (
              <a href={src} target="_blank" rel="noopener noreferrer nofollow">
                {alt || "Image"} ↗
              </a>
            ) : null,
          table: ({ node, ...props }) => (
            <div className="markdown-table-wrap">
              <table {...props} />
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
