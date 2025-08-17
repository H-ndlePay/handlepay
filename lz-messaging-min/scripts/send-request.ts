import { ethers } from 'hardhat';
import { EndpointId } from '@layerzerolabs/lz-definitions';

async function main() {
  const dstEid = EndpointId.BASESEP_V2_TESTNET;
  const recipient = process.env.BASE_RECIPIENT!;          // 0x1327...
  const amountWei = ethers.utils.parseEther('0.001');     // request 0.001 ETH

  const requester = await ethers.getContract('Requester');
  // simple options = empty, contract will add default executor gas
  const options = '0x';

  // NOTE: For testnets you can try a small native fee like 0.001. If it reverts, bump it a bit.
  const nativeFee = ethers.utils.parseEther(process.env.LZ_FEE ?? '0.001');

  const tx = await requester.requestPayment(
    dstEid, recipient, amountWei, options, { value: nativeFee }
  );
  console.log('request tx:', tx.hash);
  const rc = await tx.wait();
  // The GUID is emitted in the PaymentRequest event; grab it from logs if you want.
}
main().catch((e) => { console.error(e); process.exit(1); });
