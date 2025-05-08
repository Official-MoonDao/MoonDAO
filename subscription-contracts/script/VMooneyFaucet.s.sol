import "forge-std/Script.sol";
import "../src/VMooneyFaucet.sol";
import "../../fee-hook/script/base/Config.sol";

contract VMooneyFaucet is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        // Deploy the VMooneyFaucet contract
        VMooneyFaucet faucet = new VMooneyFaucet(MOONEY_ADDRESSES[block.chainid], VMOONEY_ADDRESSES[block.chainid], VOTING_ESCROW_DEPOSITOR_ADDRESSES[block.chainid]);

        // end the broadcast
        vm.stopBroadcast();


    }
}

