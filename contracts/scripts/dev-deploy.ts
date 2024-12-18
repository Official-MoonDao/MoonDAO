import { wallet, dec, save } from "./helpers";
import { ethers, BigNumber, Contract } from "ethers";
import { formatUnits } from "@ethersproject/units";

import MyToken from "../out/MyToken.sol/MyToken.json";
import VotingEscrow from "../out/VotingEscrow.vy/VotingEscrow.json";

const getContractFactory = (artifact: any) => {
    return new ethers.ContractFactory(artifact.abi, artifact.bytecode.object, wallet);
};

const deployContract = async ({
    name,
    deployer,
    factory,
    args,
}: {
    name: string;
    deployer: ethers.Wallet;
    factory: ethers.ContractFactory;
    args: Array<any>;
}) => {
    console.log(`Deploying ${name}..`);
    const contract = await factory.connect(deployer).deploy(...args, {
        gasLimit: BigNumber.from(8000000),
    });
    await contract.deployed();
    console.log(`Deployed ${name} to: ${contract.address}`);
    return contract;
};

const deployMOONEY = async () => {
    const supply: BigNumber = BigNumber.from(process.env.MOONEY_SUPPLY ?? dec(42069, 18));
    const Factory = getContractFactory(MyToken);

    const MOONEYToken = await deployContract({
        name: "MOONEY",
        deployer: wallet,
        factory: Factory,
        args: ["Mooney", "MOONEY"],
    });

    //await MOONEYToken.connect(wallet).mint(wallet.address, supply);
    console.log(`Minted ${formatUnits(supply, 18)} tokens to deployer address`);

    return MOONEYToken;
};

const deployVMOONEY = async (MOONEYToken: Contract) => {
    const Factory = getContractFactory(VotingEscrow);

    const vMOONEY = await deployContract({
        name: "vMOONEY",
        deployer: wallet,
        factory: Factory,
        args: [MOONEYToken.address, "Vote-escrowed MOONEY", "vMOONEY", "vMOONEY_1.0.0"],
    });

    return vMOONEY;
};

// const deployAirdropDistributor = async (MOONEYToken: Contract, root: string) => {
//     const Factory = getContractFactory(MerkleDistributorV2);
//     const dropAmount = BigNumber.from(process.env.AIRDROP_AMOUNT ?? dec(314, 18));

//     const airdropDistributor = await deployContract({
//         name: "nationDropContract",
//         deployer: wallet,
//         factory: Factory,
//         args: []
//     })
//     await airdropDistributor.setUp(wallet.address, MOONEYToken.address, root);

//     await MOONEYToken.connect(wallet).approve(airdropDistributor.address, dropAmount);
//     console.log(`Approved ${formatUnits(dropAmount, 18)} tokens for drop`);

//     return airdropDistributor;
// }

// const deployLiquidityDistributor = async (rewardsToken: Contract, boostToken: Contract) => {
//     const contractFactory = getContractFactory(LiquidityDistributor);
//     const tokenFactory = getContractFactory(MockERC20);
//     const supply = BigNumber.from(dec(314, 18));
//     const rewards = BigNumber.from(dec(500, 18));
//     const rewardsPeriod = 1196308; // 6 months of blocks approx

//     const lpToken = await deployContract({
//         name: "lpToken",
//         deployer: wallet,
//         factory: tokenFactory,
//         args: ["80NATION-20WETH", "80NATION-20WETH", supply]
//     })

//     const distributor = await deployContract({
//         name: "lpRewardsContract",
//         deployer: wallet,
//         factory: contractFactory,
//         args: []
//     })

//     await distributor.connect(wallet).initialize(rewardsToken.address, lpToken.address, boostToken.address);

//     const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
//     const blockNumber = await provider.getBlockNumber();
//     // Setup rewards
//     await rewardsToken.connect(wallet).mint(distributor.address, rewards);
//     const startBlock = blockNumber + 5;
//     const endBlock = startBlock + rewardsPeriod;

//     await distributor.connect(wallet).setRewards(rewards, startBlock, endBlock);
//     console.log(`Set ${formatUnits(rewards, 18)} NATIONs as rewards from block ${startBlock} to ${endBlock}`)

//     return { "lpToken": lpToken, "lpRewardsContract": distributor}
// }

// const deployPassport = async (governanceToken: Contract) => {
//     const passportFactory = getContractFactory(Passport);
//     const passportIssuerFactory = getContractFactory(PassportIssuer);

//     const passportToken = await deployContract({
//         name: "Passport",
//         deployer: wallet,
//         factory: passportFactory,
//         args: ["Nation3 Passport", "PASS3"]
//     })

//     const passportIssuer = await deployContract({
//         name: "PassportIssuer",
//         deployer: wallet,
//         factory: passportIssuerFactory,
//         args: []
//     })

//     await passportToken.connect(wallet).transferControl(passportIssuer.address);
//     // TODO: Set renderer

//     await passportIssuer.connect(wallet).initialize(governanceToken.address, passportToken.address, 420);
//     await passportIssuer.connect(wallet).setParams(0, 0);
//     await passportIssuer.connect(wallet).setStatement("By claiming a Nation3 passport I agree to the terms defined in the following URL");
//     await passportIssuer.connect(wallet).setTermsURI("https://bafkreiadlf3apu3u7blxw7t2yxi7oyumeuzhoasq7gqmcbaaycq342xq74.ipfs.dweb.link");
//     await passportIssuer.connect(wallet).setEnabled(true);

//     return { "passportToken": passportToken, "passportIssuer": passportIssuer }
// }

const main = async () => {
    console.log(`Using deployer: ${wallet.address}`);

    const MOONEY = await deployMOONEY();
    const vMOONEY = await deployVMOONEY(MOONEY);

    const deployment = {
        MOONEYToken: MOONEY.address,
        vMOONEYToken: vMOONEY.address,
    };

    const manifestFile = "./deployments/local.json";
    save(deployment, manifestFile);

    console.log(`Deployment manifest saved to ${manifestFile}`);
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
