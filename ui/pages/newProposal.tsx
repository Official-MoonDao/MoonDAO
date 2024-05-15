import Head from '../components/layout/Head'
import dynamic from "next/dynamic";
import { GetMarkdown, SetMarkdown } from "@nance/nance-editor";
import "@nance/nance-editor/lib/css/editor.css";
import "@nance/nance-editor/lib/css/dark.css";
import ProposalTitleInput from "../components/nance/ProposalTitleInput";
import { TEMPLATE } from "../lib/nance";

export default function NewProposal() {
  let getMarkdown: GetMarkdown;
  let setMarkdown: SetMarkdown;

  const NanceEditor = dynamic(
    async () => {
      getMarkdown = (await import("@nance/nance-editor")).getMarkdown;
      setMarkdown = (await import("@nance/nance-editor")).setMarkdown;
      return import("@nance/nance-editor").then(mod => mod.NanceEditor);
    }, {
      ssr: false,
    });

  const fileUploadIPFS = {
    gateway: process.env.NEXT_PUBLIC_INFURA_IPFS_GATEWAY as string,
    auth: `Basic ${Buffer.from(
      `${process.env.NEXT_PUBLIC_INFURA_IPFS_ID}:${process.env.NEXT_PUBLIC_INFURA_IPFS_SECRET}`,
    ).toString("base64")}`
  };

  return (
    <div className="flex flex-col justify-center items-center animate-fadeIn">
      <Head title="NewProposal" />
      <div className="w-full sm:w-[90%] lg:w-3/4">
        <h1 className="page-title py-10">New Proposal</h1>
        <ProposalTitleInput />
        <NanceEditor
          initialValue={TEMPLATE}
          onEditorChange={(markdown: string) => {
            console.log(markdown);
          }}
          fileUploadIPFS={fileUploadIPFS}
          darkMode={true}
        />
      </div>
    </div>
  )
}
