const chains = ["mainnet", "arbitrum-mainnet", "base-mainnet"];
const JB_V5_MULTI_TERMINAL = "0x2dB6d704058E552DeFE415753465df8dF0361846";
const JB_V5_TERMINAL_STORE = "0xfE33B439Ec53748C87DcEDACb83f05aDd5014744";
const JB_NATIVE_TOKEN_ADDRESS = "0x000000000000000000000000000000000000EEEe";
const u256ToBytes = (n) =>
  Array.from({ length: 32 }, (_, i) =>
    Number((n >> (8n * BigInt(31 - i))) & 0xffn)
  );
const responses = await Promise.all(
  chains.map((chain, i) =>
    Functions.makeHttpRequest({
      url: `https://${chain}.infura.io/v3/357d367444db45688746488a06064e7c`,
      method: "POST",
      data: {
        jsonrpc: "2.0",
        id: 0,
        method: "eth_call",
        params: [
          {
            to: JB_V5_TERMINAL_STORE,
            data: `0x467f4cb9${JB_V5_MULTI_TERMINAL.slice(2).padStart(
              64,
              "0"
            )}${args[i].slice(2)}${JB_NATIVE_TOKEN_ADDRESS.slice(2).padStart(
              64,
              "0"
            )}`,
          },
          "latest",
        ],
      },
    })
  )
);
const totalFunding = responses.reduce(
  (sum, r) => sum + BigInt(r.data.result || 0n),
  0n
);
return new Uint8Array([...u256ToBytes(totalFunding)]);
