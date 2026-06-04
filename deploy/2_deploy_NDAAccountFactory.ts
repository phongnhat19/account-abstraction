import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const NDA_DEPLOY_CHAIN_IDS = new Set([31337, 1337, 704])

const deployNDAAccountFactory: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const from = await provider.getSigner().getAddress()
  const chainId = Number((await provider.getNetwork()).chainId)

  const forceDeployFactory = process.argv.join(' ').match(/nda-account-factory|simple-account-factory/) != null

  if (!forceDeployFactory && !NDA_DEPLOY_CHAIN_IDS.has(chainId)) {
    console.log('Skipping NDAAccountFactory on chainId', chainId, '(use --nda-account-factory to force)')
    return
  }

  const entrypoint = await hre.deployments.get('EntryPoint')
  console.log('Deploying NDAAccountFactory with EntryPoint', entrypoint.address)
  const useDeterministic = chainId !== 704
  const gasLimit = 8e6
  await hre.deployments.deploy(
    'NDAAccountFactory', {
      from,
      args: [entrypoint.address],
      gasLimit,
      log: true,
      deterministicDeployment: useDeterministic
    })

  await hre.deployments.deploy('TestCounter', {
    from,
    gasLimit: 4e6,
    deterministicDeployment: useDeterministic,
    log: true
  })
}

deployNDAAccountFactory.dependencies = ['EntryPoint']
deployNDAAccountFactory.tags = ['NDAAccountFactory']

export default deployNDAAccountFactory
