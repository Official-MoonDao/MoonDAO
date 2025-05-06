pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/CrossChainMinter.sol";
import { OptionsBuilder } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";


contract MyScript is Script {
    using OptionsBuilder for bytes;

    function addressToBytes32(address _addr) public pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    function run() external {
        uint32 eid;
        if(block.chainid == 1) { //mainnet
            eid = 30101;
        } else if (block.chainid == 8453) { //base
            eid = 8453;
        } else if (block.chainid == 84532) { //base-sep
            eid = 40245;
        } else if (block.chainid == 421614) { //arb-sep
            eid = 40231;
        } else if (block.chainid == 11155111) { //sep
            eid = 40161;
        }
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        // testing arb-sep -> sep
        uint16 destinationEid = 40161;
        address sourceAddress = 0xfF113d31149F63732B8943a9Ea12b738cB343202;
        
        CrossChainMinter minter = CrossChainMinter(sourceAddress);
        bytes memory _options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(300000, 0.0111 ether);

        minter.crossChainMint{value:0.022 ether}(destinationEid , _options, 0x7a524e73eaB5D7A7fad9FA9fE11A24eBF11971a0, "name", "bio", "image", "location", "discord", "twitter", "website", "_view", "formId");
        vm.stopBroadcast();
    }
}
