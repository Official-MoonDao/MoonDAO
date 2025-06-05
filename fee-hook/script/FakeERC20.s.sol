// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Script } from "forge-std/Script.sol";
import { FakeERC20 } from "../src/FakeERC20.sol";
import {Config} from "./base/Config.sol";

contract DeployMockERC20 is Script, Config {
    function run() external {
        // Start the deployment process
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);

        // Deploy the FakeERC20 contract and mint tokens to the sender
        uint256 initialSupply = 1000000 * 10**18;  // Adjust the amount you want to mint
        FakeERC20 token0 = new FakeERC20{salt: currentSalt()}(initialSupply, "FakeToken 4", "FAKE4", deployerAddress);


        // End the deployment process
        vm.stopBroadcast();
    }
}

