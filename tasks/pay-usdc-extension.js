// tasks/pay-usdc-extension.js
const {task} = require('hardhat/config');

const IERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner,address spender) view returns (uint256)',
  'function approve(address spender,uint256 value) returns (bool)',
];

task('pay-usdc-extension', 'Send USDC cross-chain via HandleRegistry Extension')
    .addParam('platform', 'Handle platform (e.g., twitter)')
    .addParam('username', 'Handle username')
    .addParam('amount', 'USDC amount (e.g., 2.0)')
    .addParam('sourceChain', 'Source chain (e.g., base)')
    .addParam('destinationChain', 'Destination chain (e.g., ethereum)')
    .addOptionalParam(
        'extension', 'HandleRegistry Extension address',
        '0x7A6fFC3E69f70E781C4Cd3070cd2f87390a39D72')
    .addOptionalParam('pk', 'Private key hex (no 0x prefix)')
    .setAction(async (args, hre) => {
      const {ethers} = hre;

      // Setup signer
      const signer = args.pk ? 
          new ethers.Wallet('0x' + args.pk, ethers.provider) :
          (await ethers.getSigners())[0];

      console.log(`\n🔄 USDC Cross-chain Payment via Extension`);
      console.log(`   From: ${args.sourceChain} → To: ${args.destinationChain}`);
      console.log(`   Payer: ${await signer.getAddress()}`);
      console.log(`   Handle: @${args.username} on ${args.platform}`);

      // Get extension contract
      const extension = await ethers.getContractAt('HandleRegistryUSDCExtension', args.extension, signer);

      // Get USDC contract for source chain
      const sourceUSDC = await extension.chainToUSDC(args.sourceChain);
      console.log(`   Source USDC: ${sourceUSDC}`);

      const usdc = new ethers.Contract(sourceUSDC, IERC20_ABI, signer);
      const decimals = await usdc.decimals();
      const amount = ethers.parseUnits(args.amount, decimals);
      console.log(`   Amount: ${args.amount} USDC`);

      // Check and approve USDC
      console.log(`\n💰 Checking USDC allowance...`);
      const userAddress = await signer.getAddress();
      const allowance = await usdc.allowance(userAddress, args.extension);
      
      if (allowance < amount) {
        console.log(`   Approving USDC...`);
        const approveTx = await usdc.approve(args.extension, amount);
        console.log(`   Approval tx: ${approveTx.hash}`);
        await approveTx.wait();
        console.log(`   ✅ USDC approved`);
      } else {
        console.log(`   ✅ Sufficient allowance already exists`);
      }

      // Execute cross-chain payment
      console.log(`\n🚀 Initiating cross-chain payment...`);
      const payTx = await extension.payUSDCToHandle(
        args.platform,
        args.username,
        amount,
        args.sourceChain,
        args.destinationChain
      );

      console.log(`   Payment tx: ${payTx.hash}`);
      const receipt = await payTx.wait();
      console.log(`   ✅ Payment initiated in block ${receipt.blockNumber}`);

      // Parse the event to get burn tx hash
      const iface = extension.interface;
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed.name === 'USDCPaymentInitiated') {
            console.log(`   Burn TX Hash: ${parsed.args.burnTxHash}`);
            console.log(`\n⏳ Cross-chain transfer initiated!`);
            console.log(`   The transfer will complete automatically via CCTP.`);
            console.log(`   This typically takes 10-20 minutes.`);
            break;
          }
        } catch (e) {
          // Ignore parsing errors for other events
        }
      }

      console.log(`\n✅ USDC payment initiated successfully!`);
      console.log(`   Check your subgraph for the USDCPaymentInitiated event.`);
    });