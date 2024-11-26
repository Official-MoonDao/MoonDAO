import Container from "@/components/layout/Container";
import ContentLayout from "@/components/layout/ContentLayout";
import WebsiteHead from "@/components/layout/Head";
import { NoticeFooter } from "@/components/layout/NoticeFooter";
import { pinBlobOrFile } from "@/lib/ipfs/pinBlobOrFile";
import { NanceEditor } from "@nance/nance-editor";
import '@nance/nance-editor/lib/css/dark.css'
import '@nance/nance-editor/lib/css/editor.css'

const title = 'New Contribution';
const description = (
  <span>
    <p>Submit a contribution to be included in the Coordinape circle.</p>
  </span>
);

export default function NewContribution(){
  return (
    <>
      <WebsiteHead title={title} description={description} />
      <Container>
        <ContentLayout
          header="Submit a Contribution"
          headerSize="40px"
          description={description}
          isProfile={true}
          mainPadding
          mode="compact"
        >
          <NanceEditor
            fileUploadExternal={ async (val) => {
              const res = await pinBlobOrFile(val)
              return res.url;
            }}
            darkMode={true}
          />
        </ContentLayout>
        <NoticeFooter />
      </Container>
    </>
  )
}
