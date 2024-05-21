import { NanceProvider } from "@nance/nance-hooks";
import ProposalEditor from "../components/nance/ProposalEditor";

const apiUrl = process.env.NODE_ENV === "development" ? "http://localhost:3003" : "https://api.nance.app";

export default function NewProposal() {
  return (
    <NanceProvider apiUrl={apiUrl}>
      <ProposalEditor />
    </NanceProvider>
  )
}
