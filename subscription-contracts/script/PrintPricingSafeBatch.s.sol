// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {CitizenCheckout} from "../src/CitizenCheckout.sol";
import {CheckoutOnlyMinter} from "../src/CheckoutOnlyMinter.sol";

interface IPricingAdmin {
    function setDiscount(uint256 discount) external;
    function setPricePerSecond(uint256 pricePerSecond) external;
    function setOpenAccess(bool openAccess) external;
    function setWhitelist(address whitelist) external;
}

/// @notice Safe Transaction Builder batch for the Admin Safe
///         `0x29B0D7d7f0C88Ce0DF1De5888b37B90A6faF75cB` (Arbitrum, 2 of 4).
///
/// Deploy the app that calls CitizenCheckout before this batch is executed.
/// The batch deploys the checkout, then closes direct citizen mints, so an
/// old app would be unable to mint.
///
///   cd subscription-contracts
///   forge script script/PrintPricingSafeBatch.s.sol --via-ir -vv
///
/// Import script/safe-tx-pricing-batch.json in Safe → Transaction Builder.
contract PrintPricingSafeBatch is Script {
    address constant SAFE = 0x29B0D7d7f0C88Ce0DF1De5888b37B90A6faF75cB;
    address constant CITIZEN = 0x6E464F19e0fEF3DB0f3eF9FD3DA91A297DbFE002;
    address constant TEAM = 0xAB2C354eC32880C143e87418f80ACc06334Ff55F;
    address constant TEAM_CREATOR = 0xb11017A04dB4503066Bfbb8acB6a71Fc26869C9d;
    address constant CREATE2 = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    address constant SWAP_ROUTER = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;
    address constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address constant MOONEY = 0x1Fa56414549BdccBB09916f61f0A5827f779a85c;
    address constant VE = 0xB255c74F8576f18357cE6184DA033c6d93C71899;
    address constant SPONSOR = 0xb206325E6562517532686dFeeEaD4C104D9F5d32;

    // 0.36 ETH / 365 days, and 0.027 ETH / 365 days. Both are two significant figures.
    uint256 constant TEAM_PRICE_PER_SECOND = 11415525114;
    uint256 constant CITIZEN_PRICE_PER_SECOND = 856165313;
    uint24 constant POOL_FEE = 10000;

    bytes32 constant CHECKOUT_SALT = keccak256("moonDAO.citizenCheckout.v1");
    bytes32 constant ALLOWLIST_SALT = keccak256("moonDAO.citizenCheckoutAllowlist.v1");

    string constant OUTPUT = "script/safe-tx-pricing-batch.json";

    function run() external {
        bytes memory checkoutInit = abi.encodePacked(
            type(CitizenCheckout).creationCode,
            abi.encode(SAFE, CITIZEN, SWAP_ROUTER, WETH, MOONEY, VE, SPONSOR, POOL_FEE)
        );
        address checkout = vm.computeCreate2Address(CHECKOUT_SALT, keccak256(checkoutInit), CREATE2);

        bytes memory allowInit = abi.encodePacked(
            type(CheckoutOnlyMinter).creationCode,
            abi.encode(checkout)
        );
        address allowlist = vm.computeCreate2Address(ALLOWLIST_SALT, keccak256(allowInit), CREATE2);

        string memory txs;
        uint256 n;
        txs = _append(txs, n++, CREATE2, abi.encodePacked(CHECKOUT_SALT, checkoutInit));
        txs = _append(txs, n++, CREATE2, abi.encodePacked(ALLOWLIST_SALT, allowInit));
        txs = _append(txs, n++, TEAM, abi.encodeCall(IPricingAdmin.setDiscount, (0)));
        txs = _append(txs, n++, TEAM, abi.encodeCall(IPricingAdmin.setPricePerSecond, (TEAM_PRICE_PER_SECOND)));
        txs = _append(txs, n++, TEAM_CREATOR, abi.encodeCall(IPricingAdmin.setOpenAccess, (true)));
        txs = _append(txs, n++, CITIZEN, abi.encodeCall(IPricingAdmin.setPricePerSecond, (CITIZEN_PRICE_PER_SECOND)));
        txs = _append(txs, n++, CITIZEN, abi.encodeCall(IPricingAdmin.setOpenAccess, (false)));
        txs = _append(txs, n++, CITIZEN, abi.encodeCall(IPricingAdmin.setWhitelist, (allowlist)));

        string memory json = string.concat(
            "{\"version\":\"1.0\",",
            "\"chainId\":\"42161\",",
            "\"createdAt\":0,",
            "\"meta\":{\"name\":\"Citizen and team pricing\",",
            "\"description\":\"Deploy CitizenCheckout ", vm.toString(checkout),
            " and allowlist ", vm.toString(allowlist),
            ". Team year 0.36 ETH, discount off, open minting. Citizen treasury share 0.027 ETH (wallet pays 0.036 ETH) and only the checkout may mint.\",",
            "\"txBuilderVersion\":\"1.16.5\",",
            "\"createdFromSafeAddress\":\"", vm.toString(SAFE), "\"},",
            "\"transactions\":[", txs, "]}"
        );
        vm.writeFile(OUTPUT, json);

        console.log("CitizenCheckout", checkout);
        console.log("CheckoutOnlyMinter", allowlist);
        console.log("Transactions", n);
        console.log("Wrote", OUTPUT);
    }

    function _append(string memory acc, uint256 index, address to, bytes memory data)
        internal
        pure
        returns (string memory)
    {
        string memory obj = string.concat(
            "{\"to\":\"", vm.toString(to), "\",",
            "\"value\":\"0\",",
            "\"data\":\"", vm.toString(data), "\",",
            "\"contractMethod\":null,\"contractInputsValues\":null}"
        );
        return index == 0 ? obj : string.concat(acc, ",", obj);
    }
}
