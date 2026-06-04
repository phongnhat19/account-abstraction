// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CaSignatureLog
 * @notice Public on-chain archive of per-transaction Vietnamese CA RSA signatures.
 *         RSA-PKCS#1 is verified off-chain by the identity service before publish.
 * @dev messageHash should match client signing, e.g.:
 *      keccak256(abi.encode("NDA_CA_USEROP", chainId, entryPoint, smartAccount, userOpHash))
 *      Distinct from onboarding message ONBOARD_NDA_CHAIN.
 */
contract CaSignatureLog is AccessControl {
    bytes32 public constant PUBLISHER_ROLE = keccak256("PUBLISHER_ROLE");

    /// @dev Prevents duplicate publish for the same account + userOpHash pair.
    mapping(address => mapping(bytes32 => bool)) public recorded;

    event UserCaSignatureRecorded(
        address indexed smartAccount,
        bytes32 indexed userOpHash,
        bytes32 indexed credentialId,
        bytes32 messageHash,
        bytes32 certFingerprint,
        bytes signature
    );

    error AlreadyRecorded(address smartAccount, bytes32 userOpHash);

    constructor(address publisher) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PUBLISHER_ROLE, publisher);
    }

    /**
     * @notice Record a user RSA signature after off-chain verification.
     * @param smartAccount ERC-4337 smart account for this action
     * @param userOpHash ERC-4337 UserOperation hash
     * @param credentialId Registered credential identifier
     * @param messageHash Hash of the exact message signed by the USB token
     * @param signature Full RSA-PKCS#1 signature bytes
     * @param certFingerprint SHA-256 fingerprint of the signing certificate
     */
    function recordUserCaSignature(
        address smartAccount,
        bytes32 userOpHash,
        bytes32 credentialId,
        bytes32 messageHash,
        bytes calldata signature,
        bytes32 certFingerprint
    ) external onlyRole(PUBLISHER_ROLE) {
        if (recorded[smartAccount][userOpHash]) {
            revert AlreadyRecorded(smartAccount, userOpHash);
        }
        recorded[smartAccount][userOpHash] = true;
        emit UserCaSignatureRecorded(
            smartAccount,
            userOpHash,
            credentialId,
            messageHash,
            certFingerprint,
            signature
        );
    }
}
