import React, { useState } from 'react';
import dynamic from "next/dynamic";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";
import { GetMarkdown } from "@nance/nance-editor";
import { LoadingSpinner } from "@/components/layout/LoadingSpinner";
import { pinBlobOrFile } from "@/lib/ipfs/pinBlobOrFile";
import { createSession, destroySession } from "@/lib/iron-session/iron-session";
import useAccount from "@/lib/nance/useAccountAddress";
import { toast } from "react-hot-toast";
import "@nance/nance-editor/lib/css/dark.css";
import "@nance/nance-editor/lib/css/editor.css";

let getMarkdown: GetMarkdown;

const NanceEditor = dynamic(
  async () => {
    getMarkdown = (await import("@nance/nance-editor")).getMarkdown;
    return import("@nance/nance-editor").then((mod) => mod.NanceEditor);
  },
  {
    ssr: false,
    loading: () => <LoadingSpinner />,
  }
);

const ContributionEditor: React.FC = () => {
  const { authenticated } = usePrivy();
  const [submitting, setSubmitting] = useState(false);
  const [coordinapeLink, setCoordinapeLink] = useState<string | null>(null);
  const { address } = useAccount();

  const handleSubmit = async () => {
    if (!authenticated) {
      toast.error("Please sign in to submit a contribution!");
      return;
    }

    setSubmitting(true);
    const accessToken = await getAccessToken();
    await createSession(accessToken);
    const loadingToast = toast.loading("Submitting contribution...");

    try {
      const body = JSON.stringify({
        description: getMarkdown(),
        address,
      });

      const res = await fetch("/api/coordinape/createContribution", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body
      });
      await destroySession(accessToken);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error);
      }

      setCoordinapeLink(`https://app.coordinape.com/circles/${data.insert_contributions_one.circle_id}`);
      toast.success("Contribution submitted successfully!");
    } catch (err) {
      toast.error("Failed to submit contribution");
    } finally {
      toast.dismiss(loadingToast);
      setSubmitting(false);
    }
  };

  if (!authenticated) {
    return <p className="py-24">Please sign in to submit a contribution!</p>;
  }

  if (coordinapeLink) {
    return (
      <div className="w-full flex flex-col justify-center items-center md:w-auto space-y-4 pb-12">
        <p className="text-2xl">Contribution submitted!</p>
        <p>
          View and edit your contribution {" "}
          <a href={coordinapeLink} target="_blank" rel="noopener noreferrer" className="underline">
            here
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full md:w-auto px-4 sm:px-0">
      <div className="h-[600px]">
        <NanceEditor
          fileUploadExternal={async (val) => {
            const res = await pinBlobOrFile(val);
            return res.url;
          }}
          darkMode={true}
        />
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="gradient-2 hover:pl-7 disabled:pl-5 disabled:opacity-30 transition-all ease-in-out duration-300 rounded-[2vmax] rounded-tl-[10px] mt-5 px-5 py-3 inline-block disabled:transform-none disabled:cursor-not-allowed"
          disabled={submitting}
          onClick={handleSubmit}
        >
          Submit Contribution
        </button>
      </div>
    </div>
  );
};

export default ContributionEditor;
