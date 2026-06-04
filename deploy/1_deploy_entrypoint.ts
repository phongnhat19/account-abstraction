import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const deployEntryPoint: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const from = await provider.getSigner().getAddress()

  const ret = await hre.deployments.deploy(
    'EntryPoint', {
      contract: 'NDAEntryPoint',
      from,
      args: [],
      gasLimit: 6e6,
      deterministicDeployment: process.env.SALT ?? true,
      log: true
    })
  console.log('==NDAEntryPoint (EntryPoint) addr=', ret.address)
}

export default deployEntryPoint
