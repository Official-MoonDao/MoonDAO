const CHAINS = ["mainnet", "arbitrum-mainnet", "base-mainnet"];
const u256ToBytes = (n) =>
  Array.from({ length: 32 }, (_, i) =>
    Number((n >> (8n * BigInt(31 - i))) & 0xffn)
  );
const totalFunding = (
  await Promise.all(
    CHAINS.map((chain, i) =>
      Functions.makeHttpRequest({
        url: `https://${chain}.infura.io/v3/357d367444db45688746488a06064e7c`,
        method: "POST",
        data: {
          jsonrpc: "2.0",
          id: 0,
          method: "eth_call",
          params: [
            {
              to: args[1],
              data: `0x9cc7f708${args[0].slice(2)}`,
            },
            "latest",
          ],
        },
      })
    )
  )
).reduce((sum, r) => sum + BigInt(r.data.result || 0n), 0n);
return new Uint8Array([...u256ToBytes(totalFunding)]);
