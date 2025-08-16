#!/usr/bin/env node
// tests/subgraph-cli.js
// Node 18+ required (uses global fetch)

function getArg(name, d = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : d;
}
function hasArg(name) {
  return process.argv.includes(`--${name}`);
}
function usage() {
  console.log(`
Usage:
  node tests/subgraph-cli.js --url <SUBGRAPH_URL> <command> [options]

Commands:
  members [--first N]
  handles-for-member --memberId <ID>
  resolve-handle --platform <p> --username <u>
  member-wallet --memberId <ID>
  payments --platform <p> --username <u> [--first N]
Options:
  --json   Print raw JSON instead of tables

Examples:
  node tests/subgraph-cli.js --url https://api.studio.thegraph.com/query/118793/handlepay-registry-base/v0.0.1 members --first 25
  node tests/subgraph-cli.js --url <URL> resolve-handle --platform twitter --username cookiestroke
  node tests/subgraph-cli.js --url <URL> member-wallet --memberId 1
  node tests/subgraph-cli.js --url <URL> handles-for-member --memberId 1
  node tests/subgraph-cli.js --url <URL> payments --platform twitter --username cookiestroke --first 10
`);
}

async function graphFetch(url, query, variables) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph HTTP ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

const QUERIES = {
  MEMBERS: `
    query Members($first: Int = 50) {
      memberCreateds(first: $first, orderBy: blockTimestamp, orderDirection: desc) {
        memberId
        wallet
        blockNumber
        blockTimestamp
      }
    }`,
  HANDLES_FOR_MEMBER: `
    query HandlesForMember($memberId: BigInt!) {
      handleAddeds(where: { memberId: $memberId }, orderBy: blockTimestamp, orderDirection: asc) {
        platform
        username
        blockTimestamp
      }
    }`,
  RESOLVE_HANDLE: `
    query ResolveHandle($platform: String!, $username: String!) {
      handleAddeds(first: 1, where: { platform: $platform, username: $username },
                   orderBy: blockTimestamp, orderDirection: desc) {
        memberId
        blockTimestamp
      }
    }`,
  MEMBER_WALLET: `
    query MemberWallet($memberId: BigInt!) {
      memberCreateds(where: { memberId: $memberId }) {
        wallet
        blockNumber
      }
    }`,
  PAYMENTS_TO_HANDLE: `
    query PaymentsToHandle($platform: String!, $username: String!, $first: Int = 20) {
      paymentSents(where: { platform: $platform, username: $username },
                   orderBy: blockTimestamp, orderDirection: desc, first: $first) {
        from
        amount
        transactionHash
        blockTimestamp
      }
    }`,
};

async function main() {
  const url = getArg("url");
  const jsonOut = hasArg("json");
  const cmd = process.argv.find((a) =>
    ["members", "handles-for-member", "resolve-handle", "member-wallet", "payments"].includes(a)
  );

  if (!url || !cmd) {
    usage();
    process.exit(1);
  }

  try {
    if (cmd === "members") {
      const first = parseInt(getArg("first", "50"), 10);
      const data = await graphFetch(url, QUERIES.MEMBERS, { first });
      if (jsonOut) return console.log(JSON.stringify(data, null, 2));
      console.table(
        data.memberCreateds.map((m) => ({
          memberId: m.memberId,
          wallet: m.wallet,
          block: m.blockNumber,
          ts: m.blockTimestamp,
        }))
      );
    }

    if (cmd === "handles-for-member") {
      const memberId = getArg("memberId");
      if (!memberId) throw new Error("--memberId is required (string, e.g. '1')");
      const data = await graphFetch(url, QUERIES.HANDLES_FOR_MEMBER, { memberId });
      if (jsonOut) return console.log(JSON.stringify(data, null, 2));
      console.table(
        data.handleAddeds.map((h) => ({
          platform: h.platform,
          username: h.username,
          ts: h.blockTimestamp,
        }))
      );
    }

    if (cmd === "resolve-handle") {
      const platform = getArg("platform");
      const username = getArg("username");
      if (!platform || !username) throw new Error("--platform and --username are required");
      const data = await graphFetch(url, QUERIES.RESOLVE_HANDLE, { platform, username });
      if (jsonOut) return console.log(JSON.stringify(data, null, 2));
      const hit = data.handleAddeds[0];
      if (!hit) return console.log("No match");
      console.log("memberId:", hit.memberId, " (from blockTimestamp:", hit.blockTimestamp, ")");
    }

    if (cmd === "member-wallet") {
      const memberId = getArg("memberId");
      if (!memberId) throw new Error("--memberId is required");
      const data = await graphFetch(url, QUERIES.MEMBER_WALLET, { memberId });
      if (jsonOut) return console.log(JSON.stringify(data, null, 2));
      const hit = data.memberCreateds[0];
      if (!hit) return console.log("No member found");
      console.log("wallet:", hit.wallet, " (created at block:", hit.blockNumber, ")");
    }

    if (cmd === "payments") {
      const platform = getArg("platform");
      const username = getArg("username");
      const first = parseInt(getArg("first", "20"), 10);
      if (!platform || !username) throw new Error("--platform and --username are required");
      const data = await graphFetch(url, QUERIES.PAYMENTS_TO_HANDLE, { platform, username, first });
      if (jsonOut) return console.log(JSON.stringify(data, null, 2));
      if (!data.paymentSents.length) return console.log("No payments found");
      console.table(
        data.paymentSents.map((p) => ({
          from: p.from,
          amount: p.amount,
          tx: p.transactionHash,
          ts: p.blockTimestamp,
        }))
      );
    }
  } catch (e) {
    console.error("Error:", e.message || e);
    process.exit(1);
  }
}

main();
