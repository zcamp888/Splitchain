// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {GroupVaultFactory} from "../src/GroupVaultFactory.sol";

/// @title Deploy
/// @notice Deploys the GroupVaultFactory (and its embedded GroupVault implementation).
/// @dev Run with:
///      forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
contract Deploy is Script {
    function run() external returns (GroupVaultFactory factory) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerKey);
        factory = new GroupVaultFactory();
        vm.stopBroadcast();

        console2.log("GroupVaultFactory deployed at:", address(factory));
        console2.log("GroupVault implementation:", factory.implementation());
    }
}