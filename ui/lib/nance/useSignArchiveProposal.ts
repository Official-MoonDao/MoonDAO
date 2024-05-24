import { useCallback } from 'react';
import { ConnectedWallet } from '@privy-io/react-auth';
import { SNAPSHOT_SPACE_NAME } from "./constants";
import { ArchiveProposal, NanceSignatureTypesMap, domain } from "@nance/nance-sdk";

export const useSignArchiveProposal = (wallet: ConnectedWallet) => {

  const signArchiveProposalAsync = useCallback(
    async (snapshotId: string) => {
      try {
        const provider = await wallet.getEthersProvider();
        const signer = provider?.getSigner();
        const address = await signer.getAddress();
        console.log("address", address  )
        const message: ArchiveProposal = {
          from: address,
          space: SNAPSHOT_SPACE_NAME,
          timestamp: Math.floor(Date.now() / 1000),
          proposal: snapshotId,
        }

        const types = NanceSignatureTypesMap.NanceArchiveProposal;
        if (signer) {
          const signature = await signer._signTypedData(domain, types, message);
          return { signature, message, address, domain, types };
        } else {
          throw new Error('Signer not available');
        }
      } catch (error) {
        throw error;
      }
    },
    [wallet]
  );

  return { signArchiveProposalAsync };
};
