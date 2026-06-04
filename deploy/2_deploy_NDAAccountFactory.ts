import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const deployNDAAccountFactory: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const from = await provider.getSigner().getAddress()
  const network = await provider.getNetwork()

  const forceDeployFactory = process.argv.join(' ').match(/nda-account-factory|simple-account-factory/) != null

  if (!forceDeployFactory && network.chainId !== 31337 && network.chainId !== 1337) {
    return
  }

  const entrypoint = await hre.deployments.get('EntryPoint')
  await hre.deployments.deploy(
    'NDAAccountFactory', {
      from,
      args: [entrypoint.address],
      gasLimit: 6e6,
      log: true,
      deterministicDeployment: true
    })

  await hre.deployments.deploy('TestCounter', {
    from,
    deterministicDeployment: true,
    log: true
  })
}

export default deployNDAAccountFactory
