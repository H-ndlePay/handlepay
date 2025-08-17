// tasks/debug-usdc-extension.js
const {task} = require('hardhat/config');

const IERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner,address spender) view returns (uint256)',
  'function approve(address spender,uint256 value) returns (bool)',
];

task('debug-usdc-extension', 'Debug USDC cross-chain payment')
    .addParam('platform', 'Handle platform (e.g., twitter)')
    .addParam('username', 'Handle username')
    .addParam('amount', 'USDC amount (e.g., 2.0)')
    .addParam('sourceChain', 'Source chain (e.g., base)')
    .addParam('destinationChain', 'Destination chain (e.g., ethereum)')
    .addOptionalParam('pk', 'Private key hex (no 0x prefix)')
    .setAction(async (args, hre) => {
      const {ethers} = hre;

      const extension = '0xec8cc5980F655cFc4BE237D4B3819B08468910c5';

      // Setup signer
      const signer = args.pk ? 
          new ethers.Wallet('0x' + args.pk, ethers.provider) :
          (await ethers.getSigners())[0];

      console.log(`\n🔍 Debugging USDC Payment`);
      console.log(`   Payer: ${await signer.getAddress()}`);
      console.log(`   Extension: ${extension}`);

      // Get extension contract
      const extensionContract = await ethers.getContractAt('HandleRegistryUSDCExtension', extension, signer);

      // Step 1: Check if handle exists
      console.log(`\n1️⃣ Checking handle resolution...`);
      try {
        const registry = await extensionContract.registry();
        console.log(`   Registry address: ${registry}`);
        
        const registryContract = await ethers.getContractAt('HandleRegistry', registry, signer);
        const member = await registryContract.getMemberByHandle(args.platform, args.username);
        console.log(`   ✅ Handle found: Member ID ${member.id}, Wallet: ${member.wallet}, Active: ${member.isActive}`);
      } catch (e) {
        console.log(`   ❌ Handle resolution failed: ${e.message}`);
        return;
      }

      // Step 2: Check chain configuration
      console.log(`\n2️⃣ Checking chain configuration...`);
      try {
        const destinationDomain = await extensionContract.chainToDomain(args.destinationChain);
        const sourceUSDC = await extensionContract.chainToUSDC(args.sourceChain);
        console.log(`   Source chain (${args.sourceChain}) USDC: ${sourceUSDC}`);
        console.log(`   Destination chain (${args.destinationChain}) domain: ${destinationDomain}`);
        
        if (sourceUSDC === '0x0000000000000000000000000000000000000000') {
          console.log(`   ❌ Source chain not configured`);
          return;
        }
        if (destinationDomain === 0n && args.destinationChain !== 'ethereum') {
          console.log(`   ❌ Destination chain not configured`);
          return;
        }
        console.log(`   ✅ Chain configuration OK`);
      } catch (e) {
        console.log(`   ❌ Chain configuration check failed: ${e.message}`);
        return;
      }

      // Step 3: Check USDC balance and allowance
      console.log(`\n3️⃣ Checking USDC balance and allowance...`);
      try {
        const sourceUSDC = await extensionContract.chainToUSDC(args.sourceChain);
        const usdc = new ethers.Contract(sourceUSDC, IERC20_ABI, signer);
        const decimals = await usdc.decimals();
        const amount = ethers.parseUnits(args.amount, decimals);
        
        const userAddress = await signer.getAddress();
        const balance = await usdc.balanceOf(userAddress);
        const allowance = await usdc.allowance(userAddress, extension);
        
        console.log(`   User USDC balance: ${ethers.formatUnits(balance, decimals)} USDC`);
        console.log(`   Extension allowance: ${ethers.formatUnits(allowance, decimals)} USDC`);
        console.log(`   Required amount: ${args.amount} USDC`);
        
        if (balance < amount) {
          console.log(`   ❌ Insufficient USDC balance`);
          return;
        }
        if (allowance < amount) {
          console.log(`   ❌ Insufficient allowance`);
          return;
        }
        console.log(`   ✅ Balance and allowance OK`);
      } catch (e) {
        console.log(`   ❌ Balance/allowance check failed: ${e.message}`);
        return;
      }

      // Step 4: Try staticCall first
      console.log(`\n4️⃣ Testing transaction with staticCall...`);
      try {
        const decimals = 6; // USDC has 6 decimals
        const amount = ethers.parseUnits(args.amount, decimals);
        
        await extensionContract.payUSDCToHandle.staticCall(
          args.platform,
          args.username,
          amount,
          args.sourceChain,
          args.destinationChain
        );
        console.log(`   ✅ staticCall succeeded - transaction should work`);
      } catch (e) {
        console.log(`   ❌ staticCall failed: ${e.message}`);
        console.log(`   This tells us exactly why the transaction would revert`);
        
        // Try multiple ways to decode the revert reason
        if (e.data) {
          console.log(`   Raw error data: ${e.data}`);
          
          // Try to decode as string
          try {
            if (e.data.length > 10) { // Has method selector + data
              const dataSlice = e.data.slice(10); // Remove method selector
              if (dataSlice.length >= 64) { // Has enough data for string
                const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + dataSlice);
                console.log(`   Decoded revert reason: "${decoded[0]}"`);
              }
            }
          } catch (decodeError) {
            console.log(`   Could not decode as string: ${decodeError.message}`);
          }
        }
        
        // Let's also check the TokenMessenger separately
        console.log(`\n5️⃣ Testing TokenMessenger directly...`);
        try {
          const TOKEN_MESSENGER = '0xBd3fa81B58Ba92a82136038B25aDec7066af3155';
          const tokenMessenger = await ethers.getContractAt(
            ['function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) external returns (uint64)'],
            TOKEN_MESSENGER,
            signer
          );
          
          const sourceUSDC = await extensionContract.chainToUSDC(args.sourceChain);
          const registry = await extensionContract.registry();
          const registryContract = await ethers.getContractAt('HandleRegistry', registry, signer);
          const member = await registryContract.getMemberByHandle(args.platform, args.username);
          
          const mintRecipient = ethers.zeroPadValue(member.wallet, 32);
          const destinationDomain = await extensionContract.chainToDomain(args.destinationChain);
          const amount = ethers.parseUnits(args.amount, 6);
          
          console.log(`   Testing TokenMessenger.depositForBurn with:`);
          console.log(`     amount: ${amount}`);
          console.log(`     destinationDomain: ${destinationDomain}`);
          console.log(`     mintRecipient: ${mintRecipient}`);
          console.log(`     burnToken: ${sourceUSDC}`);
          
          // Test if TokenMessenger itself would work
          await tokenMessenger.depositForBurn.staticCall(
            amount,
            destinationDomain,
            mintRecipient,
            sourceUSDC
          );
          console.log(`   ✅ TokenMessenger call would succeed`);
          
        } catch (tmError) {
          console.log(`   ❌ TokenMessenger would fail: ${tmError.message}`);
        }
        
        return;
      }

      console.log(`\n✅ All checks passed! The transaction should work.`);
    });