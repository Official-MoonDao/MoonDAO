import { startLocalFunctionsTestnet } from "@chainlink/functions-toolkit";

async function main() {
    const {
        anvil,
        adminWallet,
        linkTokenContract,
        functionsRouterContract,
        close,
    } = await startLocalFunctionsTestnet("","",8545);

    // deploy your consumer, init SubscriptionManager pointing at linkTokenContract.address,
    // create & fund a subscription, then call sendRequest & listen for the callback…
    console.log(`Anvil running at ${anvil}`);
    console.log(`Admin wallet: ${adminWallet.address}`);
    console.log(`LINK token address: ${linkTokenContract.address}`);
    console.log(`Functions Router address: ${functionsRouterContract.address}`);

    await close(); // shut it all down when you’re done
}

main();
