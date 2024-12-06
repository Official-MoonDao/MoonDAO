import Container from "@/components/layout/Container";
import ContentLayout from "@/components/layout/ContentLayout";
import WebsiteHead from "@/components/layout/Head";
import { LoadingSpinner } from "@/components/layout/LoadingSpinner";
import { NoticeFooter } from "@/components/layout/NoticeFooter";
import { pinBlobOrFile } from "@/lib/ipfs/pinBlobOrFile";
import { createSession, destroySession } from "@/lib/iron-session/iron-session";
import { GetMarkdown } from "@nance/nance-editor";
import "@nance/nance-editor/lib/css/dark.css"
import "@nance/nance-editor/lib/css/editor.css"
import { getAccessToken, usePrivy } from "@privy-io/react-auth";
import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "react-hot-toast";
import useAccount from "@/lib/nance/useAccountAddress";

let getMarkdown: GetMarkdown

const NanceEditor = dynamic(
  async () => {
    getMarkdown = (await import("@nance/nance-editor")).getMarkdown
    return import("@nance/nance-editor").then((mod) => mod.NanceEditor)
  },
  {
    ssr: false,
    loading: () => <LoadingSpinner />,
  }
)

const SuccessState = ({ coordinapeLink }: { coordinapeLink: string }) => (
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

const UnauthenticatedState = () => (
  <p className="py-24">Please sign in to submit a contribution!</p>
);

const ContributionForm = ({
  onSubmit
}: {
  onSubmit: () => Promise<void>
}) => {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit();
    setSubmitting(false);
  };

  return (
    <div className="w-full md:w-auto px-4 sm:px-0">
      <div className="h-[200px]">
        <NanceEditor
          fileUploadExternal={async (val) => {
            const res = await pinBlobOrFile(val)
            return res.url;
          }}
          darkMode={true}
        />
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="gradient-2 hover:pl-7 disabled:pl-5 disabled:opacity-30 transition-all ease-in-out duration-300 rounded-[2vmax] rounded-tl-[10px] mt-5 px-5 py-3 inline-block disabled:transform-nonetransform disabled:cursor-not-allowed"
          disabled={submitting}
          onClick={handleSubmit}
        >
          Submit Contribution
        </button>
      </div>
    </div>
  );
};

export default function NewContribution() {
  const { authenticated } = usePrivy();
  const [coordinapeLink, setCoordinapeLink] = useState<string | null>(null);
  const { address } = useAccount();

  const handleSubmitContribution = async () => {
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
      await destroySession(accessToken)
      const data = await res.json();
      if (!res.ok) {
        toast.dismiss(loadingToast);
        toast.error(data.error);
        return;
      }

      toast.dismiss(loadingToast);
      toast.success("Contribution submitted successfully!");
      setCoordinapeLink(`https://app.coordinape.com/circles/${data.insert_contributions_one.circle_id}`);
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error("Failed to submit contribution");
    }
  };

  const renderContent = () => {
    if (!authenticated) {
      return <UnauthenticatedState />;
    }
    if (coordinapeLink) {
      return <SuccessState coordinapeLink={coordinapeLink} />;
    }
    return (
      <ContributionForm
        onSubmit={handleSubmitContribution}
      />
    );
  };

  const title = "New Contribution";
  const description = (
    <span>
      <p>Submit a contribution to be included in the Coordinape circle.</p>
    </span>
  );

  return (
    <div className="flex flex-col justify-center items-start animate-fadeIn w-[90vw] md:w-full">
      <WebsiteHead title={title} description={description} />
      <Container>
        <ContentLayout
          header="Submit a Contribution"
          headerSize="30px"
          description={description}
          isProfile={true}
          mainPadding
          mode="compact"
        >
          <div className="flex flex-col my-8 w-full md:w-auto">
            {renderContent()}
          </div>
        </ContentLayout>
        <NoticeFooter />
      </Container>
    </div>
  );
}
