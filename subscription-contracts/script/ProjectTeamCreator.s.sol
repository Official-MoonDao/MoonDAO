// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {Project} from "../src/tables/Project.sol";
import {ProjectTeamCreator} from "../src/ProjectTeamCreator.sol";
import {IHats} from "@hats/Interfaces/IHats.sol";
import {ProjectTeam} from "../src/ProjectTeam.sol";



contract MyScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);


        address hatsAddress = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;
        address hatsModuleFactoryAddress = 0x0a3f85fa597B6a967271286aA0724811acDF5CD9;
        address hatsPassthroughAddress = 0x97b5621E4CD8F403ab5b6036181982752DE3aC44;
        address gnosisSingletonAddress = 0x3E5c63644E683549055b9Be8653de26E0B4CD36E;
        address gnosisSafeProxyFactoryAddress = 0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2;

        IHats hats = IHats(hatsAddress);


        address oldCreatorAddress = 0xe5709Bc44427DCEF81fF2F718DFc6A032fD23bbF;
        uint256 projectTeamAdminHatId = 1887196678076684115928201594833669786492226355261806482072218554597376;

        address projectAddress = 0xCb31829B312923C7502766ef4f36948A7A64cD6A;
        ProjectTeam projectTeam = ProjectTeam(projectAddress);
        address projectTableAddress = 0x83755AF34867a3513ddCE921E9cAd28f0828CDdB;


        ProjectTeamCreator creator = new ProjectTeamCreator(hatsAddress, hatsModuleFactoryAddress, hatsPassthroughAddress, address(projectTeam), gnosisSingletonAddress, gnosisSafeProxyFactoryAddress, projectTableAddress);

        creator.setProjectTeamAdminHatId(projectTeamAdminHatId);
        projectTeam.setProjectTeamCreator(address(creator));

        hats.transferHat(projectTeamAdminHatId, oldCreatorAddress, address(creator));
        //hats.mintHat(projectTeamAdminHatId, address(creator));
        //hats.changeHatEligibility(projectTeamAdminHatId, address(creator));


        vm.stopBroadcast();
    }
}
