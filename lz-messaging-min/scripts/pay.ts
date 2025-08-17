import { ethers } from 'hardhat';

async function main() {
  const guid = process.env.GUID!; // paste the invoiceId (guid) from the event
  const payStation = await ethers.getContract('PayStation');
  const value = ethers.utils.parseEther('0.001'); // exact amount to forward

  const tx = await payStation.pay(guid, { value });
  console.log('pay tx:', tx.hash);
  await tx.wait();
  console.log('paid');
}
main().catch((e) => { console.error(e); process.exit(1); });
