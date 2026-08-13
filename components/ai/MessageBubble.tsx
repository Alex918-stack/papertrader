import ReactMarkdown from "react-markdown";
import { Components } from "react-markdown";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 last:mb-0 space-y-1.5 list-disc pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 last:mb-0 space-y-1.5 list-decimal pl-5">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-emerald-400">{children}</strong>
  ),
  h1: ({ children }) => (
    <h1 className="text-base font-bold mt-4 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold mt-4 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-bold mt-3 mb-2 first:mt-0">{children}</h3>
  ),
};

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
<div className={`flex message-enter ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[85%] px-5 py-3.5 text-sm sm:text-base ${
          isUser
            ? "bg-emerald-600 text-white rounded-2xl rounded-br-md"
            : "bg-neutral-800 text-neutral-100 rounded-2xl rounded-bl-md"
        }`}
      >
{isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        ) : (
          <div
            className="text-base leading-relaxed"
            style={{ fontFamily: "var(--font-source-serif)" }}
          >
            <ReactMarkdown components={markdownComponents}>
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}