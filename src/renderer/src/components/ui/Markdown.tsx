import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@renderer/lib/cn'

/**
 * Renders Markdown safely: raw HTML is not rendered (react-markdown default),
 * and links open in the system browser (the main process only allows https).
 */
const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
}

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('prose-tm prose prose-sm max-w-none', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
