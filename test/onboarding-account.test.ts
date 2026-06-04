import { ethers } from 'hardhat'
import { expect } from 'chai'
import { toHex } from 'hardhat/internal/util/bigint'
import { JsonRpcProvider } from '@ethersproject/providers'

import {
  EntryPoint,
  NDAAccountFactory,
  NDAAccountFactory__factory,
  NDAAccount__factory
} from '../typechain'
import {
  createAccountOwner,
  deployEntryPoint,
  getAccountAddress,
  getAccountFactoryData,
  isDeployed
} from './testutils'
import {
  EXPECTED_ONBOARDING_UID,
  fingerprintToBytes32,
  loadOnboardingJson,
  parseUidFromSubject,
  uidToCreate2Salt
} from './onboarding-helpers'
import { fillAndSign, packUserOp } from './UserOp'

describe('Onboarding smart account', function () {
  const onboarding = loadOnboardingJson()
  const uid = parseUidFromSubject(onboarding.identity.subject)
  const salt = uidToCreate2Salt(uid)
  const certFingerprint = fingerprintToBytes32(onboarding.identity.fingerprintSha256)

  let entryPoint: EntryPoint
  let identityOwner: string
  let accountFactory: NDAAccountFactory
  let counterfactual: string
  const ethersSigner = ethers.provider.getSigner()

  before(async function () {
    entryPoint = await deployEntryPoint()
    identityOwner = await ethersSigner.getAddress()
    accountFactory = await new NDAAccountFactory__factory(ethersSigner).deploy(entryPoint.address)
    counterfactual = await accountFactory.getAddress(identityOwner, salt)
  })

  it('reads onboarding.json and extracts MST UID', function () {
    expect(uid).to.equal(EXPECTED_ONBOARDING_UID)
    expect(salt).to.eq(uidToCreate2Salt(EXPECTED_ONBOARDING_UID))
  })

  it('derives a stable CREATE2 salt from the UID', function () {
    expect(salt.toHexString()).to.eq(
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes(EXPECTED_ONBOARDING_UID))
    )
  })

  describe('ERC-4337 account creation from onboarding', function () {
    let accountAddress: string

    it('deploys smart account via handleOps with CREATE2 salt from MST UID', async function () {
      expect(await isDeployed(counterfactual)).to.eq(false)

      const opOwner = createAccountOwner()
      const op = await fillAndSign({
        sender: counterfactual,
        factory: accountFactory.address,
        factoryData: getAccountFactoryData(identityOwner, accountFactory, salt),
        callData: '0x',
        verificationGasLimit: 500000,
        callGasLimit: 100000,
        maxFeePerGas: 0,
        maxPriorityFeePerGas: 0
      }, opOwner, entryPoint)

      const beneficiary = (await ethers.getSigners())[2]
      await entryPoint.handleOps([packUserOp(op)], await beneficiary.getAddress())

      accountAddress = counterfactual
      expect(await isDeployed(accountAddress)).to.eq(true)
      const deployed = NDAAccount__factory.connect(accountAddress, ethersSigner)
      expect(await deployed.owner()).to.equal(identityOwner)
      expect(accountAddress).to.equal(await getAccountAddress(identityOwner, accountFactory, salt))
    })

    it('binds account to onboarding certificate fingerprint', function () {
      expect(certFingerprint).to.eq(
        fingerprintToBytes32('99:E2:44:B4:C2:99:F3:FD:F4:E1:ED:0D:E2:8E:7C:BF:BF:93:EB:25:61:BC:00:45:4C:2F:33:DE:53:55:55:1A')
      )
      expect(onboarding.identity.serialNumber).to.equal('540110005493D7765DDDAC0633A140CE')
    })

    it('factory createAccount is idempotent for the same owner and UID salt', async function () {
      const senderCreator = await entryPoint.senderCreator()
      await (ethersSigner.provider as JsonRpcProvider).send('hardhat_setBalance', [
        senderCreator,
        toHex(100e18)
      ])
      const senderCreatorSigner = await ethers.getImpersonatedSigner(senderCreator)
      await accountFactory.connect(senderCreatorSigner).createAccount(identityOwner, salt)
      expect(await accountFactory.getAddress(identityOwner, salt)).to.equal(accountAddress)
      const account = NDAAccount__factory.connect(accountAddress, ethersSigner)
      expect(await account.owner()).to.equal(identityOwner)
    })
  })
})
