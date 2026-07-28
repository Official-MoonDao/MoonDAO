// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import "base/Config.sol";

interface ISubscriptionNFT {
    function owner() external view returns (address);
    function pricePerSecond() external view returns (uint256);
    function discount() external view returns (uint256);
    function setPricePerSecond(uint256 _pricePerSecond) external;
    function getRenewalPrice(address owner, uint64 duration) external view returns (uint256);
}

/// @title SetSepoliaMintPriceZero
/// @notice Make minting a MoonDAO Team and/or Citizen free on Sepolia by zeroing each
///         subscription contract's `pricePerSecond`. Must be broadcast by the contract
///         owner (the same address owns both the Team and Citizen NFTs on Sepolia).
///
/// Why not the discount whitelist? The whitelist (`discountList`) only reduces the
/// price by `discount` (parts-per-1000) for whitelisted addresses, and is stored in a
/// private variable with no getter — using it would require deploying/wiring a new
/// whitelist. Zeroing `pricePerSecond` is a single owner call, is idempotent, matches
/// how the Team is already configured on Sepolia, and makes minting free for everyone
/// (fine on a testnet).
///
/// Usage (from subscription-contracts/):
///   export PRIVATE_KEY=0x...            # owner of the Team + Citizen NFTs
///   export SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<key>
///   forge script script/SetSepoliaMintPriceZero.s.sol \
///     --rpc-url $SEPOLIA_RPC_URL --broadcast --via-ir -vvv
///
/// Optional env: MOONDAO_TEAM, CITIZEN_NFT (override addresses), SKIP_TEAM, SKIP_CITIZEN.
contract SetSepoliaMintPriceZero is Script, Config {
    function run() external {
        address teamAddr = vm.envOr("MOONDAO_TEAM", MOONDAO_TEAM_ADDRESSES[SEP]);
        address citizenAddr = vm.envOr("CITIZEN_NFT", CITIZEN_NFT_ADDRESSES[SEP]);
        bool skipTeam = vm.envOr("SKIP_TEAM", false);
        bool skipCitizen = vm.envOr("SKIP_CITIZEN", false);

        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0));
        address sender;
        if (pk != 0) {
            sender = vm.addr(pk);
            vm.startBroadcast(pk);
        } else {
            sender = vm.envAddress("SENDER");
            vm.startBroadcast(sender);
        }

        console.log("=== Zero Sepolia mint price ===");
        console.log("Sender:", sender);

        if (!skipTeam) _zero("Team", teamAddr, sender);
        if (!skipCitizen) _zero("Citizen", citizenAddr, sender);

        vm.stopBroadcast();
    }

    function _zero(string memory label, address nft, address sender) internal {
        require(nft != address(0), string.concat("No address for ", label));
        ISubscriptionNFT sub = ISubscriptionNFT(nft);

        address owner = sub.owner();
        require(owner == sender, string.concat(label, ": sender is not the owner"));

        uint256 before = sub.pricePerSecond();
        if (before != 0) {
            sub.setPricePerSecond(0);
        }

        console.log("");
        console.log(string.concat(label, " NFT:"), nft);
        console.log("  pricePerSecond before:", before);
        console.log("  pricePerSecond after :", sub.pricePerSecond());
        console.log("  365-day mint price now (wei):", sub.getRenewalPrice(sender, 365 days));
    }
}
