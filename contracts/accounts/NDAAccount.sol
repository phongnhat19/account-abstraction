// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-inline-assembly */
/* solhint-disable reason-string */

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "../core/BaseAccount.sol";
import "../core/Helpers.sol";
import "./callback/TokenCallbackHandler.sol";

/**
 * @title NDAAccount
 * @notice ERC-4337 smart account for NDAChain (gas-free).
 *         UserOp.signature is not used for CA RSA auth; Vietnamese CA signatures are
 *         published via CaSignatureLog by the identity service after off-chain verification.
 */
contract NDAAccount is BaseAccount, TokenCallbackHandler, UUPSUpgradeable, Initializable {
    address public owner;

    IEntryPoint private immutable _entryPoint;

    event NDAAccountInitialized(IEntryPoint indexed entryPoint, address indexed owner);

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    error NotOwner(address msgSender, address entity, address owner);
    error NotOwnerOrEntryPoint(address msgSender, address entity, address entryPoint, address owner);

    /// @inheritdoc BaseAccount
    function entryPoint() public view virtual override returns (IEntryPoint) {
        return _entryPoint;
    }

    receive() external payable {}

    constructor(IEntryPoint anEntryPoint) {
        _entryPoint = anEntryPoint;
        _disableInitializers();
    }

    function _onlyOwner() internal view {
        require(
            msg.sender == owner || msg.sender == address(this),
            NotOwner(msg.sender, address(this), owner)
        );
    }

    function initialize(address anOwner) public virtual initializer {
        _initialize(anOwner);
    }

    function _initialize(address anOwner) internal virtual {
        owner = anOwner;
        emit NDAAccountInitialized(entryPoint(), owner);
    }

    function _requireForExecute() internal view override virtual {
        require(
            msg.sender == address(entryPoint()) || msg.sender == owner,
            NotOwnerOrEntryPoint(msg.sender, address(this), address(entryPoint()), owner)
        );
    }

    /// @inheritdoc BaseAccount
    /// @dev CA RSA is not validated here; see CaSignatureLog for on-chain publication.
    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
        internal
        view
        virtual
        override
        returns (uint256 validationData)
    {
        (userOp, userOpHash);
        return SIG_VALIDATION_SUCCESS;
    }

    /// @inheritdoc BaseAccount
    /// @dev NDAChain is gas-free; do not send prefund to EntryPoint.
    function _payPrefund(uint256) internal pure override {}

    function _authorizeUpgrade(address newImplementation) internal view override {
        (newImplementation);
        _onlyOwner();
    }
}
