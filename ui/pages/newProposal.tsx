import { NanceProvider } from "@nance/nance-hooks";
import ProposalEditor from "../components/nance/ProposalEditor";
import { NANCE_API_URL } from "../lib/nance/constants";

export default function NewProposal() {
  return (
    <NanceProvider apiUrl={NANCE_API_URL}>
      <ProposalEditor />
    </NanceProvider>
  )
}
