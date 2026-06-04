// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title Create2Deployer
 * @notice Arachnid-compatible CREATE2 proxy (same calldata as 0x4e59…): salt (32 bytes) || initCode.
 *         Deploy this contract with an allowlisted key on permissioned chains; it is not
 *         possible to install bytecode at 0x4e59… without the global pre-signed bootstrap tx.
 */
contract Create2Deployer {
    fallback() external payable {
        assembly {
            let addr := create2(0, 32, sub(calldatasize(), 32), calldataload(0))
            if iszero(addr) {
                revert(0, 0)
            }
            mstore(0, addr)
            return(0, 0x20)
        }
    }
}
