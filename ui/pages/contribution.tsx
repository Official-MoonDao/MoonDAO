import Container from "@/components/layout/Container";
import ContentLayout from "@/components/layout/ContentLayout";
import WebsiteHead from "@/components/layout/Head";
import { LoadingSpinner } from "@/components/layout/LoadingSpinner";
import { NoticeFooter } from "@/components/layout/NoticeFooter";
import { CoordinapeContribution, CoordinapeUser } from "@/lib/coordinape";
import { pinBlobOrFile } from "@/lib/ipfs/pinBlobOrFile";
import { GetMarkdown } from "@nance/nance-editor";
import "@nance/nance-editor/lib/css/dark.css"
import "@nance/nance-editor/lib/css/editor.css"
import { usePrivy } from "@privy-io/react-auth";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

const title = "New Contribution";
const description = (
  <span>
    <p>Submit a contribution to be included in the Coordinape circle.</p>
  </span>
);

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

export default function NewContribution(){
  const { user, authenticated } = usePrivy()
  const [coordinapeId, setCoordinapeId] = useState<CoordinapeUser | null>(null);
  const [coordinapeLink, setCoordinapeLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.wallet?.address && authenticated) {
      fetch(`/api/coordinape/getUser?address=${user.wallet.address}`)
        .then(res => res.json())
        .then(user => {
          setCoordinapeId(user)
          setLoading(false)
        })
        .catch(err => {
          console.error(err)
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [authenticated, user?.wallet?.address]);

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
            { coordinapeLink ? (
              <div className="w-full flex flex-col justify-center items-center md:w-auto space-y-4 pb-12">
                <p className="text-2xl">Contribution submitted!</p>
                <p>
                  View and edit your contribution {" "}
                  <a href={coordinapeLink} target="_blank" rel="noopener noreferrer" className="underline">
                    here
                  </a>
                </p>
              </div>
            ) : !authenticated && !loading ? (
              <p className="py-24">Please sign in to check if you are eligible to submit a contribution.</p>
            ) : !coordinapeId ? (
              <>
                <LoadingSpinner />
                <p className="text-gray-600">Checking eligibility...</p>
              </>
            ) : (
              <div className="w-full md:w-auto px-4 sm:px-0">
                <NanceEditor
                  fileUploadExternal={ async (val) => {
                    const res = await pinBlobOrFile(val)
                    return res.url;
                  }}
                  darkMode={true}
                  height="200px"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="gradient-2 hover:pl-7 disabled:pl-5 disabled:opacity-30 transition-all ease-in-out duration-300 rounded-[2vmax] rounded-tl-[10px] mt-5 px-5 py-3 inline-block disabled:transform-nonetransform disabled:cursor-not-allowed"
                    disabled={submitting}
                    onClick={async () => {
                      setSubmitting(true);
                      const loadingToast = toast.loading("Submitting contribution...");
                      try {
                        const body = JSON.stringify({
                          user_id: coordinapeId?.user_id,
                          profile_id: coordinapeId?.profile_id,
                          description: getMarkdown()
                        } as CoordinapeContribution)
                        const res = await fetch("/api/coordinape/createContribution", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json"
                          },
                          body
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          toast.dismiss(loadingToast);
                          toast.error(data.error);
                          setSubmitting(false);
                          return;
                        }
                        toast.dismiss(loadingToast);
                        toast.success("Contribution submitted successfully!");
                        setCoordinapeLink(`https://app.coordinape.com/circles/${data.insert_contributions_one.circle_id}`)
                      } catch (err) {
                        toast.dismiss(loadingToast);
                        toast.error("Failed to submit contribution");
                      }
                      setSubmitting(false);
                    }}
                  >
                    Submit Contribution
                  </button>
                </div>
              </div>
            )}
          </div>
        </ContentLayout>
        <NoticeFooter />
      </Container>
    </div>
  )
}
