// tasks/pay-eth.js
const {task} = require('hardhat/config');

task('pay-eth', 'Send ETH to a @handle via HandleRegistry.payToHandle()')
    .addParam('platform', 'e.g. twitter')
    .addParam('username', 'e.g. VitalikButerin')
    .addParam('amount', 'ETH amount, e.g. 0.01')
    .addOptionalParam(
        'registry', 'HandleRegistry address',
        '0x132727D74dF3246b64046598626415258dc648f0')
    .addOptionalParam('pk', 'Private key for payer (hex, no 0x)')
    .setAction(async (args, hre) => {
      const {ethers} = hre;

      const provider = hre.network.provider;
      const signer = args.pk ?
          new ethers.Wallet('0x' + args.pk, ethers.provider) :
          (await ethers.getSigners())[0];

      console.log('Payer:', signer.address);

      const reg =
          await ethers.getContractAt('HandleRegistry', args.registry, signer);
      const value = ethers.parseEther(args.amount);

      const tx = await reg.payToHandle(args.platform, args.username, {value});
      console.log('Submitted:', tx.hash);
      const rcpt = await tx.wait();
      console.log('Mined in block', rcpt.blockNumber);
    });
