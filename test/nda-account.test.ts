import { ethers } from 'hardhat'
import { expect } from 'chai'
import { arrayify, hexlify } from 'ethers/lib/utils'

import {
  CaSignatureLog__factory,
  EntryPoint,
  NDAAccount,
  NDAAccountFactory__factory
} from '../typechain'
import {
  createAccount,
  createAccountOwner,
  deployEntryPoint
} from './testutils'
import { fillAndSign, fillUserOpDefaults, signUserOp, packUserOp } from './UserOp'

describe('NDA stack', function () {
  let entryPoint: EntryPoint
  let caLog: Awaited<ReturnType<CaSignatureLog__factory['deploy']>>
  let account: NDAAccount
  let accountOwner: ReturnType<typeof createAccountOwner>
  const ethersSigner = ethers.provider.getSigner()
  let publisher: string
  let chainId: number

  before(async function () {
    entryPoint = await deployEntryPoint()
    chainId = (await ethers.provider.getNetwork()).chainId
    publisher = await ethersSigner.getAddress()
    caLog = await new CaSignatureLog__factory(ethersSigner).deploy(publisher)
    accountOwner = createAccountOwner()
    const { proxy } = await createAccount(ethersSigner, await accountOwner.getAddress(), entryPoint.address)
    account = proxy
  })

  describe('CaSignatureLog', function () {
    let userOpHash: string
    let credentialId: string
    let messageHash: string
    let signature: string

    before(function () {
      userOpHash = ethers.utils.keccak256(arrayify('0x1234'))
      credentialId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('cred'))
      messageHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['string', 'uint256', 'address', 'address', 'bytes32'],
          ['NDA_CA_USEROP', chainId, entryPoint.address, account.address, userOpHash]
        )
      )
      signature = hexlify(ethers.utils.randomBytes(256))
    })

    it('publisher can record RSA signature', async () => {
      await expect(
        caLog.recordUserCaSignature(
          account.address,
          userOpHash,
          credentialId,
          messageHash,
          signature,
          ethers.utils.keccak256(arrayify('0xabcd'))
        )
      )
        .to.emit(caLog, 'UserCaSignatureRecorded')
        .withArgs(
          account.address,
          userOpHash,
          credentialId,
          messageHash,
          ethers.utils.keccak256(arrayify('0xabcd')),
          signature
        )
      expect(await caLog.recorded(account.address, userOpHash)).to.eq(true)
    })

    it('rejects duplicate record', async () => {
      await expect(
        caLog.recordUserCaSignature(
          account.address,
          userOpHash,
          credentialId,
          messageHash,
          signature,
          ethers.utils.keccak256(arrayify('0xabcd'))
        )
      ).to.be.reverted
    })

    it('rejects non-publisher', async () => {
      const other = createAccountOwner()
      const userOpHash2 = ethers.utils.keccak256(arrayify('0x5678'))
      await expect(
        caLog.connect(other).recordUserCaSignature(
          account.address,
          userOpHash2,
          credentialId,
          messageHash,
          signature,
          ethers.utils.keccak256(arrayify('0xabcd'))
        )
      ).to.be.reverted
    })
  })

  describe('NDAAccount + NDAEntryPoint', function () {
    it('validateUserOp accepts empty signature', async () => {
      const epSigner = await ethers.getImpersonatedSigner(entryPoint.address)
      await ethers.provider.send('hardhat_setBalance', [entryPoint.address, '0x1000000000000000000'])
      const userOp = signUserOp(
        fillUserOpDefaults({ sender: account.address }),
        accountOwner,
        entryPoint.address,
        chainId
      )
      const packed = packUserOp(userOp)
      const userOpHash = await entryPoint.getUserOpHash(packed)
      const validationData = await account.connect(epSigner).callStatic.validateUserOp(packed, userOpHash, 0)
      expect(validationData).to.eq(0)
    })

    it('handleOps succeeds without account EntryPoint deposit', async function () {
      const counter = await (await ethers.getContractFactory('TestCounter')).deploy()
      const callData = account.interface.encodeFunctionData('execute', [
        counter.address,
        0,
        counter.interface.encodeFunctionData('count')
      ])
      const op = await fillAndSign({
        sender: account.address,
        callData,
        verificationGasLimit: 200000,
        callGasLimit: 200000,
        maxFeePerGas: 0,
        maxPriorityFeePerGas: 0
      }, accountOwner, entryPoint)
      const beneficiary = (await ethers.getSigners())[1].getAddress()
      const countBefore = await counter.counters(account.address)
      await entryPoint.handleOps([packUserOp(op)], await beneficiary)
      const countAfter = await counter.counters(account.address)
      expect(countAfter.sub(countBefore).toNumber()).to.eq(1)
    })
  })

  describe('NDAAccountFactory', function () {
    it('deploys implementation', async () => {
      const factory = await new NDAAccountFactory__factory(ethersSigner).deploy(entryPoint.address)
      expect(await factory.accountImplementation()).to.properAddress
    })
  })
})
