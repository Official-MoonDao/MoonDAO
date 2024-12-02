import Container from "@/components/layout/Container";
import ContentLayout from "@/components/layout/ContentLayout";
import WebsiteHead from "@/components/layout/Head";
import { LoadingSpinner } from "@/components/layout/LoadingSpinner";
import { NoticeFooter } from "@/components/layout/NoticeFooter";
import { CoordinapeUser } from "@/lib/coordinape";
import { pinBlobOrFile } from "@/lib/ipfs/pinBlobOrFile";
import { GetMarkdown } from "@nance/nance-editor";
import "@nance/nance-editor/lib/css/dark.css"
import "@nance/nance-editor/lib/css/editor.css"
import { usePrivy } from "@privy-io/react-auth";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

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
  const [coordinapeId, setCoordinapeId] = useState<CoordinapeUser | null>(null)
  const [loading, setLoading] = useState(true);

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
          <div className="flex flex-col justify-center items-center my-8 px-4 w-full md:w-auto">
            {!authenticated && !loading ? (
              <p className="py-24">Please sign in to check if you are eligible to submit a contribution.</p>
            ) : !coordinapeId ? (
              <>
                <LoadingSpinner />
                <p className="text-gray-600">Checking eligibility...</p>
              </>
            ) : (
              <div className="w-full md:w-auto">
                <NanceEditor
                  fileUploadExternal={ async (val) => {
                    const res = await pinBlobOrFile(val)
                    return res.url;
                  }}
                  darkMode={true}
                  height="200px"
                />
              </div>
            )}
            <div className="w-full flex justify-end">
              <button
                type="submit"
                className='gradient-2 hover:pl-7 transform transition-all ease-in-out duration-300 rounded-[2vmax] rounded-tl-[10px] mt-5 px-5 py-3 inline-block'
                onClick={() => {
                  alert(getMarkdown())
                }}
                // data-tip={
                //   signingStatus === 'loading'
                //     ? 'Signing...'
                //     : 'You need to connect wallet first.'
                // }
              >
                Submit Contribution
              </button>
            </div>
          </div>
        </ContentLayout>
        <NoticeFooter />
      </Container>
    </div>
  )
}
