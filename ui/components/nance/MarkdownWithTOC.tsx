import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import ReactMarkdown from "react-markdown";
import { h } from "hastscript";
import { getActionYamlFromBody, trimActionsFromBody } from "@nance/nance-sdk";
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel
} from "@headlessui/react";

export default function MarkdownWithTOC({ body }: { body: string }) {
  return (
    <div className="bg-dark-cool border-t-[3px] border-darkest-cool rounded-[20px]">
      <article className="w-full prose-full prose-lg prose-indigo break-words text-gray-500 p-10">
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
            h2: ({ node, ...props }) => <h2 className="group font-GoodTimes" {...props} />,
            h3: ({ node, ...props }) => <h3 className="group font-GoodTimes" {...props} />,
            h4: ({ node, ...props }) => <h4 className="group font-GoodTimes" {...props} />,
            h5: ({ node, ...props }) => <h5 className="group font-GoodTimes" {...props} />,
            h6: ({ node, ...props }) => <h6 className="group font-GoodTimes" {...props} />,
            table: ({ node, ...props }) => (
              <div className="overflow-x-auto">
                <table className="text-center border-b" {...props} />
              </div>
            ),
            th: ({ node, ...props }) => <th className="whitespace-nowrap border-r border-gray-200 last:border-r-0" {...props} />,
            td: ({ node, ...props }) => <td className="whitespace-nowrap border-r border-gray-200 last:border-r-0" {...props} />,
            p: ({ node, ...props }) => <p className="text-white" {...props} />, 
            li: ({ node, ...props }) => (
              <li className="list-disc list-inside text-white" {...props} />
            ),
          }}
        >
          { trimActionsFromBody(body) }
        </ReactMarkdown>
        { getActionYamlFromBody(body) && (
          <Disclosure as="div" className="text-gray bg-slate-200 rounded-lg">
            {({ open }) => (
              <>
                
              </>
            )}
          </Disclosure>
        )}
      </article>
    </div>  
  );
}
