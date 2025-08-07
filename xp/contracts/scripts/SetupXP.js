const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Setting up XP System...\n");

  // Step 1: Get deployed contract addresses
  const XPManagerAddress = "0x..."; // Replace with deployed address
  const OwnsCitizenNFTAddress = "0x..."; // Replace with deployed address
  const CitizenNFTAddress = "0x..."; // Replace with your MoonDAO Citizen NFT address
  const RewardTokenAddress = "0x..."; // Replace with your reward token address

  // Step 2: Get contract instances
  const XPManager = await ethers.getContractFactory("XPManager");
  const xpManager = XPManager.attach(XPManagerAddress);

  const OwnsCitizenNFT = await ethers.getContractFactory("OwnsCitizenNFT");
  const citizenVerifier = OwnsCitizenNFT.attach(OwnsCitizenNFTAddress);

  // Step 3: Verify the setup
  console.log("📋 Verifying setup...");

  const verifierAddress = await xpManager.verifiers(1);
  console.log("Verifier at condition ID 1:", verifierAddress);

  const verifierName = await citizenVerifier.name();
  console.log("Verifier name:", verifierName);

  // Step 4: Example of how a user would claim XP
  console.log("\n🎯 Example: User claiming XP for owning Citizen NFT");

  const [signer] = await ethers.getSigners();
  const userAddress = signer.address;

  // Context: ABI encode (citizenNFTAddress, xpAmount)
  const context = ethers.utils.defaultAbiCoder.encode(
    ["address", "uint256"],
    [CitizenNFTAddress, ethers.utils.parseEther("100")] // 100 XP
  );

  // Check eligibility
  const [eligible, xpAmount] = await citizenVerifier.isEligible(
    userAddress,
    context
  );
  console.log("User eligible:", eligible);
  console.log("XP amount:", ethers.utils.formatEther(xpAmount));

  if (eligible) {
    // Generate claim ID
    const claimId = await citizenVerifier.claimId(userAddress, context);
    console.log("Claim ID:", claimId);

    // Check if already claimed
    const alreadyClaimed = await xpManager.usedProofs(claimId);
    console.log("Already claimed:", alreadyClaimed);

    if (!alreadyClaimed) {
      console.log("✅ User can claim XP!");
      console.log("Call: xpManager.claimXP(1, context)");
    } else {
      console.log("❌ User already claimed this XP");
    }
  } else {
    console.log("❌ User not eligible - needs to own a Citizen NFT");
  }

  console.log("\n🎉 Setup complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
