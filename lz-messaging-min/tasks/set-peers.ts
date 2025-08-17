import { task } from 'hardhat/config';
import { ethers } from 'hardhat';
import { EndpointId } from '@layerzerolabs/lz-definitions';

function toBytes32(addr: string) {
  return ethers.utils.hexZeroPad(addr, 32);
}

// dst: "base" or "eth"
task('setPeer', 'Set OApp peer')
  .addParam('contract', 'Requester or PayStation')
  .addParam('dst', 'base | eth')
  .addParam('peer', 'peer address on dst chain')
  .setAction(async ({ contract, dst }) => {
    const dstEid =
      dst === 'base'
        ? EndpointId.BASE_V2_MAINNET
        : EndpointId.ETHEREUM_V2_MAINNET;

    const c = await ethers.getContract(contract);
    const tx = await c.setPeer(dstEid, toBytes32(process.env.PEER!));
    console.log('setPeer tx:', tx.hash);
    await tx.wait();
    console.log('peer set');
  });
