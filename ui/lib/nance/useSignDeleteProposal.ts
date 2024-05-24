import { useCallback, useContext } from 'react';
import PrivyWalletContext from "../privy/privy-wallet-context";
import { useWallets } from '@privy-io/react-auth';
import { SNAPSHOT_SPACE_NAME } from "./constants";
import { SnapshotTypes, domain, formatSnapshotDeleteProposalMessage } from "@nance/nance-sdk";

export const useSignDeleteProposal = () => {
  const { selectedWallet } = useContext(PrivyWalletContext);
  const { wallets } = useWallets();

  const signDeleteProposalAsync = useCallback(
    async (snapshotId: string) => {
      try {
        const provider = await wallets[selectedWallet].getEthersProvider();
        const signer = provider?.getSigner();
        const address = await signer.getAddress();

        const message = formatSnapshotDeleteProposalMessage(
          address,
          SNAPSHOT_SPACE_NAME,
          snapshotId
        );

        const types = SnapshotTypes.cancelProposal2Types;
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
    [selectedWallet, wallets]
  );

  return { signDeleteProposalAsync, wallet: wallets[selectedWallet] };
};
