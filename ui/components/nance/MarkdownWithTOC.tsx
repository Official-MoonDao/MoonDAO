import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import ReactMarkdown from "react-markdown";
import { h } from "hastscript";
import { getActionYamlFromBody, trimActionsFromBody } from "@nance/nance-sdk";
import { Disclosure } from "@headlessui/react";

export default function MarkdownWithTOC({ body }: { body: string }) {
  return (
    <article className="prose prose-lg prose-indigo break-words text-gray-500">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          rehypeSanitize,
          rehypeSlug,
          [
            rehypeAutolinkHeadings,
            {
              content(node: any) {
                return [h("span.ml-2.hidden.group-hover:inline", "#")];
              },
              behavior: "append",
            },
          ],
        ]}
        components={{
          h2: ({ node, ...props }) => <h2 className="group" {...props} />,
          h3: ({ node, ...props }) => <h3 className="group" {...props} />,
          h4: ({ node, ...props }) => <h4 className="group" {...props} />,
          h5: ({ node, ...props }) => <h5 className="group" {...props} />,
          h6: ({ node, ...props }) => <h6 className="group" {...props} />,
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto">
              <table className="text-center border-b" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => <th className="whitespace-nowrap border-r border-gray-200 last:border-r-0" {...props} />,
          td: ({ node, ...props }) => <td className="whitespace-nowrap border-r border-gray-200 last:border-r-0" {...props} />,
        }}
      >
        { trimActionsFromBody(body) }
      </ReactMarkdown>
      { getActionYamlFromBody(body) && (
        <Disclosure as="div" className="text-gray bg-slate-200 rounded-lg">
          {({ open }) => (
            <>
              <dt>
                <Disclosure.Button className="flex w-fit p-2 font-mono text-sm">
                  {open ? (
                    "(hide trimmed action text) ↑"
                  ) : (
                    "(show trimmed action text) ↓"
                  )}
                </Disclosure.Button>
              </dt>
              <Disclosure.Panel as="dd" className="pr-4 pb-4">
                <pre>
                  {getActionYamlFromBody(body)}
                </pre>
              </Disclosure.Panel>
            </>
          )}
        </Disclosure>
      )}
    </article>
  );
}
