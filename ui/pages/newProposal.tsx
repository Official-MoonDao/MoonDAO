import Head from '../components/layout/Head'
import dynamic from "next/dynamic";
import { GetMarkdown, SetMarkdown } from "@nance/nance-editor";
import "@nance/nance-editor/lib/css/editor.css";
import "@nance/nance-editor/lib/css/dark.css";
import ProposalTitleInput from "../components/nance/ProposalTitleInput";
import { TEMPLATE } from "../lib/nance";
import { EIP712Domain, signTypedDataInternal, useSigner } from "@thirdweb-dev/react";
import { SnapshotTypes, domain, formatSnapshotProposalMessage } from "@nance/nance-sdk";
import { Proposal } from "@nance/nance-sdk";

export default function NewProposal() {
  const signer = useSigner()
  
  // Nance Editior
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
        <div className="mt-3 flex justify-end">
          {/* Submit buttons */}
          <div className="flex justify-end space-x-5">
            {/*  DRAFT */}
            <button
              type="button"
              className={`text-sm px-5 py-3 border border-dashed border-moon-orange font-RobotoMono rounded-sm hover:rounded-tl-[22px] hover:rounded-br-[22px] duration-300`}
              onClick={async () => {
                if (!signer) return
                const address = await signer.getAddress()
                const message = formatSnapshotProposalMessage(
                  address,
                  {
                    title: "Proposal Title",
                    body: getMarkdown(),
                  } as Proposal,
                  "tomoondao.eth",
                  new Date(),
                  new Date()
                )
                console.log(message)
                const signature = await signTypedDataInternal(signer, domain as EIP712Domain, SnapshotTypes.proposalTypes, message)
                console.log(signature)
              }}
            >
              Save Draft
            </button>
            {/* SUBMIT */}
            <button
              type="button"
              className={`px-5 py-3 bg-moon-orange border border-transparent font-RobotoMono rounded-sm hover:rounded-tl-[22px] hover:rounded-br-[22px] duration-300`}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
