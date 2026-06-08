import * as path from 'path'
import { ethers } from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import {
  EntryPoint__factory,
  NDAAccount__factory,
  NDAAccountFactory__factory
} from '../typechain'
import {
  createAccountOwner,
  getAccountFactoryData,
  isDeployed
} from '../test/testutils'
import {
  fingerprintToBytes32,
  loadOnboardingJson,
  parseUidFromSubject,
  uidToCreate2Salt
} from '../test/onboarding-helpers'
import { fillAndSign, packUserOp } from '../test/UserOp'

export interface OnboardNdaChainOptions {
  onboardingPath?: string
  dryRun?: boolean
  hre: HardhatRuntimeEnvironment
}

export async function onboardNdaChain (options: OnboardNdaChainOptions): Promise<void> {
  const { hre } = options
  const onboardingPath = options.onboardingPath ??
    process.env.ONBOARDING_JSON ??
    path.join(__dirname, '../test/onboarding.json')
  const dryRun = options.dryRun ??
    (process.env.ONBOARDING_DRY_RUN === '1' || process.env.ONBOARDING_DRY_RUN === 'true')

  const network = await ethers.provider.getNetwork()
  if (Number(network.chainId) !== 704) {
    console.warn('Warning: expected ndachain chainId 704, got', network.chainId)
  }

  const entryPointDep = await hre.deployments.getOrNull('EntryPoint')
  const factoryDep = await hre.deployments.getOrNull('NDAAccountFactory')
  if (entryPointDep == null || factoryDep == null) {
    throw new Error(
      'Missing deployments for this network. Run: npx hardhat deploy --network ndachain'
    )
  }

  const bundler = ethers.provider.getSigner()
  const bundlerAddress = await bundler.getAddress()
  const identityOwner = process.env.NDA_ACCOUNT_OWNER ?? bundlerAddress

  const entryPoint = EntryPoint__factory.connect(entryPointDep.address, bundler)
  const accountFactory = NDAAccountFactory__factory.connect(factoryDep.address, bundler)

  const onboarding = loadOnboardingJson(onboardingPath)
  const uid = parseUidFromSubject(onboarding.identity.subject)
  const salt = uidToCreate2Salt(uid)
  const certFingerprint = fingerprintToBytes32(onboarding.identity.fingerprintSha256)

  const smartAccount = await accountFactory.getAddress(identityOwner, salt)

  console.log('--- NDAChain onboarding ---')
  console.log('network chainId:', network.chainId)
  console.log('onboarding file:', path.resolve(onboardingPath))
  console.log('EntryPoint:', entryPoint.address)
  console.log('NDAAccountFactory:', accountFactory.address)
  console.log('bundler:', bundlerAddress)
  console.log('account owner:', identityOwner)
  console.log('UID:', uid)
  console.log('CREATE2 salt:', salt.toHexString())
  console.log('cert fingerprint:', certFingerprint)
  console.log('counterfactual smart account:', smartAccount)

  if (await isDeployed(smartAccount)) {
    const account = NDAAccount__factory.connect(smartAccount, bundler)
    console.log('Smart account already deployed. owner=', await account.owner())
    return
  }

  if (dryRun) {
    console.log('dry-run: skipping handleOps')
    return
  }

  const opSigner = createAccountOwner(ethers.provider)
  const userOp = await fillAndSign({
    sender: smartAccount,
    factory: accountFactory.address,
    factoryData: getAccountFactoryData(identityOwner, accountFactory, salt),
    callData: '0x',
    verificationGasLimit: 800000,
    callGasLimit: 150000,
    maxFeePerGas: 0,
    maxPriorityFeePerGas: 0,
    preVerificationGas: 50000
  }, opSigner, entryPoint)

  const packedOp = packUserOp(userOp)
  console.log('Submitting handleOps (account creation UserOp)...')
  console.log(
    'UserOp gas: verification=%s call=%s preVerification=%s maxFee=%s',
    userOp.verificationGasLimit.toString(),
    userOp.callGasLimit.toString(),
    userOp.preVerificationGas.toString(),
    userOp.maxFeePerGas.toString()
  )

  // Provider gas estimation for handleOps is far too low for CREATE2 deploy; callStatic needs ~2M+.
  const tx = await entryPoint.handleOps([packedOp], bundlerAddress, {
    gasLimit: 5_000_000,
    gasPrice: 1
  })
  const receipt = await tx.wait()
  console.log('handleOps tx:', receipt.transactionHash, 'status:', receipt.status)

  if (receipt.status !== 1) {
    throw new Error(`handleOps reverted (tx ${receipt.transactionHash})`)
  }

  if (!(await isDeployed(smartAccount))) {
    throw new Error(`Account not deployed at ${smartAccount} after handleOps`)
  }

  const deployed = NDAAccount__factory.connect(smartAccount, bundler)
  console.log('Deployed smart account:', smartAccount)
  console.log('owner:', await deployed.owner())
  console.log('serialNumber (from JSON):', onboarding.identity.serialNumber)
}
