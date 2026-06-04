// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import "../interfaces/IEntryPoint.sol";
import "../interfaces/ISenderCreator.sol";
import "./NDAAccount.sol";

/**
 * @title NDAAccountFactory
 * @notice Factory for NDAAccount ERC-4337 smart accounts.
 */
contract NDAAccountFactory {
    NDAAccount public immutable accountImplementation;
    ISenderCreator public immutable senderCreator;

    error NotSenderCreator(address msgSender, address entity, address senderCreator);

    constructor(IEntryPoint _entryPoint) {
        accountImplementation = new NDAAccount(_entryPoint);
        senderCreator = _entryPoint.senderCreator();
    }

    function createAccount(address owner, uint256 salt) public returns (NDAAccount ret) {
        require(
            msg.sender == address(senderCreator),
            NotSenderCreator(msg.sender, address(this), address(senderCreator))
        );
        address addr = getAddress(owner, salt);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return NDAAccount(payable(addr));
        }
        ret = NDAAccount(payable(new ERC1967Proxy{salt: bytes32(salt)}(
            address(accountImplementation),
            abi.encodeCall(NDAAccount.initialize, (owner))
        )));
    }

    function getAddress(address owner, uint256 salt) public view returns (address) {
        return Create2.computeAddress(bytes32(salt), keccak256(abi.encodePacked(
            type(ERC1967Proxy).creationCode,
            abi.encode(
                address(accountImplementation),
                abi.encodeCall(NDAAccount.initialize, (owner))
            )
        )));
    }
}
