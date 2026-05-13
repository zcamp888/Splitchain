// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {GroupVault} from "./GroupVault.sol";

/// @title GroupVaultFactory
/// @notice Deploys minimal-proxy clones of `GroupVault` for each SplitChain group.
/// @dev Stateless beyond the implementation pointer and a per-group registry.
///      A single group can have multiple vaults (one per trip).
contract GroupVaultFactory {
    /// @notice The reference implementation cloned by every vault.
    address public immutable implementation;

    /// @notice All vaults ever created by this factory (append-only).
    address[] public allVaults;

    /// @notice Per off-chain group ID → list of vault clone addresses.
    mapping(bytes32 => address[]) private vaultsByGroup;

    event VaultCreated(
        bytes32 indexed groupId,
        address indexed vault,
        address indexed creator,
        address token,
        uint256 targetPerMember,
        uint256 memberCount
    );

    error ImplementationZero();
    error NoMembers();

    constructor() {
        // Deploy the implementation once. It can never be initialized — it
        // exists solely to be cloned.
        implementation = address(new GroupVault());
    }

    /// @notice Creates a new vault clone for `groupId`.
    /// @param groupId The off-chain group identifier (UUID hashed to bytes32).
    /// @param token The ERC20 token the vault will hold.
    /// @param targetPerMember Informational target deposit per member.
    /// @param members Initial member list.
    /// @return vault The address of the new clone.
    function createVault(
        bytes32 groupId,
        address token,
        uint256 targetPerMember,
        address[] calldata members
    ) external returns (address vault) {
        if (members.length == 0) revert NoMembers();

        vault = Clones.clone(implementation);
        GroupVault(vault).initialize(msg.sender, token, targetPerMember, members);

        allVaults.push(vault);
        vaultsByGroup[groupId].push(vault);

        emit VaultCreated(
            groupId,
            vault,
            msg.sender,
            token,
            targetPerMember,
            members.length
        );
    }

    /// @notice Vaults belonging to a given off-chain group.
    function vaultsOf(bytes32 groupId) external view returns (address[] memory) {
        return vaultsByGroup[groupId];
    }

    /// @notice Total vaults ever created.
    function vaultCount() external view returns (uint256) {
        return allVaults.length;
    }
}