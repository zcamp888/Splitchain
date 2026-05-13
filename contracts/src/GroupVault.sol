// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title GroupVault
/// @notice Trustless escrow for a single group trip. Members deposit upfront,
///         any member can claim reimbursement during the trip, and remaining
///         balance refunds proportionally on close.
/// @dev Deployed via minimal proxy clone from GroupVaultFactory. Single-use:
///      once closed, the vault is permanently dead.
contract GroupVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @notice The ERC20 token held by this vault (e.g. USDC).
    IERC20 public token;

    /// @notice The group owner who can close the vault.
    address public owner;

    /// @notice The factory that deployed this vault (immutable after init).
    address public factory;

    /// @notice Target deposit amount per member (informational, not enforced).
    uint256 public targetPerMember;

    /// @notice Whether the vault has been closed (terminal state).
    bool public closed;

    /// @notice Sentinel set in initialize() to prevent re-initialization.
    bool private initialized;

    /// @notice Members of this vault.
    address[] private membersList;

    /// @notice Quick membership lookup.
    mapping(address => bool) public isMember;

    /// @notice Cumulative deposits per member.
    mapping(address => uint256) public deposited;

    /// @notice Cumulative claims per member.
    mapping(address => uint256) public claimed;

    /// @notice Total deposited across all members.
    uint256 public totalDeposited;

    /// @notice Total claimed across all members.
    uint256 public totalClaimed;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event VaultInitialized(
        address indexed owner,
        address indexed token,
        uint256 targetPerMember,
        address[] members
    );

    event Deposited(address indexed member, uint256 amount, uint256 newBalance);

    event ReimbursementClaimed(
        address indexed member,
        uint256 amount,
        bytes32 indexed expenseId
    );

    event VaultClosed(uint256 totalRefunded, uint256 memberCount);

    event Refunded(address indexed member, uint256 amount);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error AlreadyInitialized();
    error NotInitialized();
    error NotOwner();
    error NotMember();
    error NotFactory();
    error VaultIsClosed();
    error VaultNotClosed();
    error ZeroAmount();
    error ZeroAddress();
    error InsufficientBalance();
    error EmptyMembers();
    error DuplicateMember();
    error TooManyMembers();

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyMember() {
        if (!isMember[msg.sender]) revert NotMember();
        _;
    }

    modifier whenOpen() {
        if (closed) revert VaultIsClosed();
        _;
    }

    // -------------------------------------------------------------------------
    // Initialization (clone pattern — no constructor)
    // -------------------------------------------------------------------------

    /// @notice Initializes a freshly-cloned vault. Callable once, by the factory.
    /// @param _owner The group owner who can close the vault.
    /// @param _token The ERC20 token (e.g. USDC) this vault holds.
    /// @param _targetPerMember Informational target deposit per member.
    /// @param _members Initial member list. Must be non-empty and unique.
    function initialize(
        address _owner,
        address _token,
        uint256 _targetPerMember,
        address[] calldata _members
    ) external {
        if (initialized) revert AlreadyInitialized();
        if (_owner == address(0)) revert ZeroAddress();
        if (_token == address(0)) revert ZeroAddress();
        if (_members.length == 0) revert EmptyMembers();
        if (_members.length > 100) revert TooManyMembers();

        initialized = true;
        factory = msg.sender;
        owner = _owner;
        token = IERC20(_token);
        targetPerMember = _targetPerMember;

        for (uint256 i = 0; i < _members.length; i++) {
            address m = _members[i];
            if (m == address(0)) revert ZeroAddress();
            if (isMember[m]) revert DuplicateMember();
            isMember[m] = true;
            membersList.push(m);
        }

        emit VaultInitialized(_owner, _token, _targetPerMember, _members);
    }

    // -------------------------------------------------------------------------
    // Deposits
    // -------------------------------------------------------------------------

    /// @notice Deposit `amount` of the vault token. Caller must have approved
    ///         this contract for at least `amount` first.
    /// @dev Members can deposit any amount, any number of times, up until close.
    function deposit(uint256 amount) external nonReentrant whenOpen onlyMember {
        if (amount == 0) revert ZeroAmount();

        // Effects before interactions (CEI).
        deposited[msg.sender] += amount;
        totalDeposited += amount;

        // Pull tokens.
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Deposited(msg.sender, amount, deposited[msg.sender]);
    }

    // -------------------------------------------------------------------------
    // Claims (reimbursement during trip)
    // -------------------------------------------------------------------------

    /// @notice Any member can claim `amount` as reimbursement for `expenseId`.
    /// @dev Trust model: v1 lets any member claim freely. All claims are logged
    ///      on-chain via `ReimbursementClaimed` for off-chain auditing.
    /// @param amount The token amount to withdraw.
    /// @param expenseId The off-chain expense identifier (UUID hashed to bytes32).
    function claimReimbursement(uint256 amount, bytes32 expenseId)
        external
        nonReentrant
        whenOpen
        onlyMember
    {
        if (amount == 0) revert ZeroAmount();
        uint256 bal = remainingBalance();
        if (amount > bal) revert InsufficientBalance();

        // Effects.
        claimed[msg.sender] += amount;
        totalClaimed += amount;

        // Interaction.
        token.safeTransfer(msg.sender, amount);

        emit ReimbursementClaimed(msg.sender, amount, expenseId);
    }

    // -------------------------------------------------------------------------
    // Close + proportional refund
    // -------------------------------------------------------------------------

    /// @notice Closes the vault and refunds remaining balance to depositors
    ///         pro-rata to their deposits.
    /// @dev Only the owner can close. Dust from integer division stays in the
    ///      contract permanently — typically a few wei, acceptable tradeoff
    ///      vs. complex dust-handling logic.
    function close() external nonReentrant whenOpen onlyOwner {
        closed = true;

        uint256 refundPool = remainingBalance();
        uint256 totalDep = totalDeposited;
        uint256 refundedSum = 0;
        uint256 memberCount = membersList.length;

        if (refundPool > 0 && totalDep > 0) {
            for (uint256 i = 0; i < memberCount; i++) {
                address m = membersList[i];
                uint256 share = (refundPool * deposited[m]) / totalDep;
                if (share > 0) {
                    refundedSum += share;
                    token.safeTransfer(m, share);
                    emit Refunded(m, share);
                }
            }
        }

        emit VaultClosed(refundedSum, memberCount);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice Current token balance held by the vault.
    function remainingBalance() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @notice Total members in the vault.
    function memberCount() external view returns (uint256) {
        return membersList.length;
    }

    /// @notice Full member list. Cheap for typical vault sizes (≤100).
    function members() external view returns (address[] memory) {
        return membersList;
    }

    /// @notice Convenience: how much `member` has net contributed (deposited − claimed).
    function netContribution(address member) external view returns (int256) {
        return int256(deposited[member]) - int256(claimed[member]);
    }
}