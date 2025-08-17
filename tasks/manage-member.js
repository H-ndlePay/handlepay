// tasks/manage-member.js
const {task, types} = require('hardhat/config');

function handleKey(hre, platform, username) {
  return hre.ethers.solidityPackedKeccak256(
      ['string', 'string', 'string'], [platform, ':', username]);
}

task('manage-member', 'Create a member and add handles; optional ETH payment')
    .addParam('wallet', 'Member wallet address')
    .addOptionalParam(
        'registry', 'Registry address',
        process.env.REGISTRY_ADDRESS ||
            '0x132727D74dF3246b64046598626415258dc648f0')
    .addOptionalParam(
        'pay', 'ETH amount to send to handle(s)', undefined, types.string)
    .addFlag('payEach', 'If set, pay each handle instead of just the first')
    .addVariadicPositionalParam(
        'handles', 'Handles as platform:username', [], types.string)
    .setAction(async ({wallet, registry, pay, payEach, handles}, hre) => {
      if (!wallet) throw new Error('--wallet is required');
      if (!handles.length)
        throw new Error('Provide at least one handle: platform:username');

      const [signer] = await hre.ethers.getSigners();
      console.log('Signer:', signer.address);

      const r =
          await hre.ethers.getContractAt('HandleRegistry', registry, signer);

      const owner = await r.owner();
      if (owner.toLowerCase() !== signer.address.toLowerCase()) {
        throw new Error(
            `Signer is not owner. Owner=${owner}, Signer=${signer.address}`);
      }
      console.log('Owner check ✅');

      // create member if missing  ⬅️ REPLACE THIS WHOLE BLOCK
      let existing = await r.walletToMemberId(wallet);  // BigInt
      let memberId = Number(existing);

      if (memberId === 0) {
        console.log('Creating member for', wallet);
        const tx = await r.createMember(wallet);
        console.log('create tx:', tx.hash);
        const receipt = await tx.wait(2);

        // parse MemberCreated from the receipt logs
        const iface = r.interface;
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog(log);
            if (parsed.name === 'MemberCreated') {
              memberId = Number(parsed.args.memberId);
              break;
            }
          } catch {
          }
        }
        if (!memberId) throw new Error('Could not find MemberCreated event');

        const m = await r.members(memberId);
        if (!m.isActive)
          throw new Error(
              `Member ${memberId} not active after create (unexpected)`);

        console.log(`Member created with id=${memberId}`);
      }


      // add handles
      for (const h of handles) {
        const [platform, username] = (h || '').split(':');
        if (!platform || !username)
          throw new Error(`Bad handle "${h}", use platform:username`);
        const key = handleKey(hre, platform, username);
        const taken = await r.handleToMemberId(key);  // BigInt
        if (taken === 0n) {
          console.log(`Adding handle ${platform}:${username}…`);
          await r.addHandle.staticCall(
              memberId, platform, username);  // v6 static call
          const tx = await r.addHandle(memberId, platform, username);
          await tx.wait(3);
          console.log('  added ✅');
        } else if (Number(taken) === memberId) {
          console.log(`Handle ${platform}:${
              username} already on this member, skipping.`);
        } else {
          console.log(`Handle ${platform}:${username} taken by memberId=${
              taken.toString()}, skipping.`);
        }
      }

      // optional ETH payment
      if (pay) {
        const value = hre.ethers.parseEther(pay);
        const targets = payEach ? handles : [handles[0]];
        for (const h of targets) {
          const [platform, username] = h.split(':');
          console.log(`Paying ${pay} ETH to @${username} on ${platform}…`);
          const tx = await r.payToHandle(platform, username, {value});
          await tx.wait(1);
          console.log('  payment sent ✅');
        }
      }

      console.log('Done.');
    });
