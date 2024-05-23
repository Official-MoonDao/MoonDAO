import Head from "../../components/layout/Head"
import dynamic from "next/dynamic";
import { GetMarkdown } from "@nance/nance-editor";
import "@nance/nance-editor/lib/css/editor.css";
import "@nance/nance-editor/lib/css/dark.css";
import ProposalTitleInput, { TITLE_ID } from "../../components/nance/ProposalTitleInput";
import { useSignProposal } from "../../lib/nance/useSignProposal";
import { TEMPLATE } from "../../lib/nance";
import { Proposal, ProposalStatus } from "@nance/nance-sdk";
import toast from "react-hot-toast";
import toastStyle from "../../lib/marketplace/marketplace-utils/toastConfig";
import { useProposal, useProposalUpload, useSpaceInfo } from "@nance/nance-hooks";
import { NANCE_SPACE_NAME } from "../../lib/nance/constants";
import { StringParam, useQueryParams } from "next-query-params";
import { add, differenceInDays } from "date-fns";
import { useState } from "react";
import { LoadingSpinner } from "../../components/layout/LoadingSpinner";

type SignStatus = "idle" | "loading" | "success" | "error";

  // Nance Editor
  let getMarkdown: GetMarkdown;

  const NanceEditor = dynamic(
    async () => {
      getMarkdown = (await import("@nance/nance-editor")).getMarkdown;
      return import("@nance/nance-editor").then(mod => mod.NanceEditor);
    }, {
      ssr: false,
      loading: () => <LoadingSpinner />,
    }
  );

export default function ProposalEditor() {
  // get space info to find next Snapshot Vote
  // we need this to be compliant with the proposal signing format of Snapshot
  const { data: spaceInfoData } = useSpaceInfo({ space: NANCE_SPACE_NAME });
  const spaceInfo = spaceInfoData?.data;
  const { nextEvents, currentEvent } = spaceInfo || {};
  let nextSnapshotVote = nextEvents?.find((event) => event.title === "Snapshot Vote");
  const nextProposalId = spaceInfo?.nextProposalId;
  if (currentEvent?.title === "Temperature Check") {
    const days = differenceInDays(
      new Date(nextEvents?.slice(-1)[0]?.start || ""),
      new Date(currentEvent.start),
    );
    nextSnapshotVote = {
      title: "Snapshot Vote",
      start: add(new Date(nextSnapshotVote?.start || ""), { days }).toISOString(),
      end: add(new Date(nextSnapshotVote?.end || ""), { days }).toISOString(),
    };
  }

  // load proposal if proposalId is present (edit)
  const [{ proposalId }] = useQueryParams({ proposalId: StringParam });
  const shouldFetch = !!proposalId;
  const { data } = useProposal({ space: NANCE_SPACE_NAME, uuid: proposalId! }, shouldFetch)
  const loadedProposal = data?.data;

  const [status, setStatus] = useState<SignStatus>("idle");
  const [initialValue, setInitialValue] = useState<string>(TEMPLATE);

  // proposal upload
  const { signProposalAsync, wallet } = useSignProposal();
  const { trigger } = useProposalUpload(NANCE_SPACE_NAME, loadedProposal?.uuid);
  const buttonsDisabled = !wallet?.linked || status === "loading";

  const fileUploadIPFS = {
    gateway: process.env.NEXT_PUBLIC_INFURA_IPFS_GATEWAY as string,
    auth: `Basic ${Buffer.from(
      `${process.env.NEXT_PUBLIC_INFURA_IPFS_ID}:${process.env.NEXT_PUBLIC_INFURA_IPFS_SECRET}`,
    ).toString("base64")}`
  };

  const buildProposal = (status: ProposalStatus) => {
    const titleVal = (document?.getElementById(TITLE_ID) as HTMLInputElement).value;
    const proposalId = loadedProposal?.proposalId || nextProposalId;
    return {
      title: `MDP-${proposalId}: ${titleVal}`,
      body: getMarkdown(),
      status,
    } as Proposal
  }

  async function signAndSendProposal(proposal: Proposal) {
    if (!proposal.title) {
      toast.error("Please enter a title for the proposal", { style: toastStyle });
      return;
    }
    if (!nextSnapshotVote) return;
    setStatus("loading");
    setInitialValue(proposal.body); // save the current proposal body to be used in case of error
    signProposalAsync(proposal, nextSnapshotVote).then((res) => {
      const { signature, address, message, domain, types } = res;
      trigger({
        space: NANCE_SPACE_NAME,
        proposal,
        envelope: { // Snapshot data envelope
          address,
          sig: signature,
          data: { message, domain, types }
        }
      }).then((res) => {
        if (res.success) {
          setStatus("success");
          toast.success(
            "Draft saved successfully",
            { style: toastStyle }
          );
          window.location.href = `/proposal/${res.data.uuid}`;
        } else {
          setStatus("error");
          toast.error(
            "Error saving draft",
            { style: toastStyle }
          );
        }
      })
    }).catch((error) => {
      setStatus("idle");
      toast.error(
        `Error signing proposal:\n${error}`,
        { style: toastStyle }
      );
    });
  }

  const pageTitle = proposalId ? "Edit Proposal" : "New Proposal";

  return (
    <div className="flex flex-col justify-center items-center animate-fadeIn">
      <Head title={pageTitle} />
      <div className="w-full sm:w-[90%] lg:w-3/4">
        <h1 className="page-title py-10">{pageTitle}</h1>
        <ProposalTitleInput initialValue={loadedProposal?.title} />
        <NanceEditor
          initialValue={initialValue}
          fileUploadIPFS={fileUploadIPFS}
          darkMode={true}
        />
        <div className="mt-3 flex justify-end">
          {/* Submit buttons */}
          <div className="flex justify-end space-x-5">
            {/*  DRAFT */}
            <button
              type="button"
              className={`text-sm px-5 py-3 border border-dashed border-moon-orange font-RobotoMono rounded-sm hover:rounded-tl-[22px] hover:rounded-br-[22px] duration-300 disabled:cursor-not-allowed disabled:hover:rounded-sm disabled:opacity-40`}
              onClick={() => {
                const proposal = buildProposal("Draft");
                signAndSendProposal(proposal);
              }}
              disabled={buttonsDisabled}
            >
              {status === "loading" ? "Signing..." : "Save Draft"}
            </button>
            {/* SUBMIT */}
            <button
              type="button"
              className={`px-5 py-3 bg-moon-orange border border-transparent font-RobotoMono rounded-sm hover:rounded-tl-[22px] hover:rounded-br-[22px] duration-300 disabled:cursor-not-allowed disabled:hover:rounded-sm disabled:opacity-40`}
              onClick={() => {
                const status = loadedProposal?.status === "Temperature Check" ? "Temperature Check" : "Discussion";
                const proposal = buildProposal(status || "Discussion");
                signAndSendProposal(proposal);
              }}
              disabled={buttonsDisabled}
            >
              {status === "loading" ? "Signing..." : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
