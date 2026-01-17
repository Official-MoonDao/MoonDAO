import { useCallback, useContext } from 'react';
import PrivyWalletContext from "../privy/privy-wallet-context";
import { ConnectedWallet } from '@privy-io/react-auth';
import { SNAPSHOT_SPACE_NAME } from "./constants";
import { domain, formatSnapshotDeleteProposalMessage, nanceSignatureMap } from "@nance/nance-sdk";

export const useSignDeleteProposal = (wallet: ConnectedWallet) => {
  const { selectedWallet } = useContext(PrivyWalletContext);

  const signDeleteProposalAsync = useCallback(
    async (snapshotId: string) => {
      try {
        const provider = await wallet.getEthersProvider();
        const signer = provider?.getSigner();
        
        if (!signer) {
          throw new Error('Signer not available');
        }

        const address = await signer.getAddress();

        const message = formatSnapshotDeleteProposalMessage(
          address,
          SNAPSHOT_SPACE_NAME,
          snapshotId
        );

        const { types } = nanceSignatureMap["SnapshotCancelProposal"];

        let signature: string;

        try {
          // Try the standard EIP-712 signTypedData method first
          if (typeof (signer as any).signTypedData === 'function') {
            console.log('Using public signTypedData method');
            signature = await (signer as any).signTypedData(domain, types, message);
          } else if (typeof (signer as any)._signTypedData === 'function') {
            console.log('Using internal _signTypedData method');
            signature = await (signer as any)._signTypedData(domain, types, message);
          } else {
            throw new Error('Wallet does not support EIP-712 typed data signing');
          }
        } catch (signingError: any) {
          console.error('EIP-712 signing failed:', signingError);
          
          if (signingError.code === 4001 || signingError.message?.includes('User rejected')) {
            throw new Error('Signature request was rejected. Please try again.');
          } else if (signingError.message?.includes('not support')) {
            throw new Error('Your wallet does not support the required signing method. Please try a different wallet.');
          } else if (signingError.name === 'TimeoutError') {
            throw signingError;
          } else {
            throw new Error(`Failed to sign delete request: ${signingError.message || 'Unknown error'}`);
          }
        }

        return { signature, message, address, domain, types };
      } catch (error) {
        throw error;
      }
    }, [wallet]
  );

  return { signDeleteProposalAsync };
};
