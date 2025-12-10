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
    <div className="md:bg-dark-cool rounded-[10px]">
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
              <div className="mb-5">
                <table className="text-center w-full bg-gradient-to-b from-black to-[#030517]" {...props} />
              </div>
            ),
            th: ({ node, ...props }) => <th className="whitespace-normal border-[5px] border-[#0b0c21] text-white py-[10px] px-[20px] max-w-[100%] bg-transparent" {...props} />,
            td: ({ node, ...props }) => <td className="whitespace-normal border-[5px] border-[#0b0c21] text-white py-[10px] px-[20px] max-w-[100%] bg-transparent" {...props} />,
            p: ({ node, ...props }) => <p className="text-white" {...props} />,
            a: ({ node, ...props }) => (
              <a className="text-blue-400 hover:text-blue-300 underline transition-colors" {...props} />
            ),
            ul: ({ node, ...props }) => (
              <ul className="list-disc ml-6 mb-4 text-white" style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }} {...props} />
            ),
            ol: ({ node, ...props }) => (
              <ol className="list-decimal ml-6 mb-4 text-white" style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }} {...props} />
            ),
            li: ({ node, ...props }) => (
              <li className="text-white mb-3 leading-relaxed" style={{ marginBottom: '0.75rem', display: 'list-item' }} {...props} />
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
