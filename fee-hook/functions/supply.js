const tokens = [
  { chain: "mainnet", address: "0xCc71C80d803381FD6Ee984FAff408f8501DB1740" },
  {
    chain: "arbitrum-mainnet",
    address: "0xB255c74F8576f18357cE6184DA033c6d93C71899",
  },
  {
    chain: "polygon-mainnet",
    address: "0xe2d1BFef0A642B717d294711356b468ccE68BEa6",
  },
  {
    chain: "base-mainnet",
    address: "0x7f8f1B45c3FD6Be4F467520Fc1Cf030d5CaBAcF5",
  },
];
const u256ToBytes = (n) =>
  Array.from({ length: 32 }, (_, i) =>
    Number((n >> (8n * BigInt(31 - i))) & 0xffn)
  );
const buildCalls = (addr, usr) =>
  [
    "0x18160ddd" /*totalSupply*/,
    `0x70a08231${usr.slice(2).padStart(64, "0")}` /*balanceOf(address)*/,
  ].map((data, id) => ({
    jsonrpc: "2.0",
    id,
    method: "eth_call",
    params: [{ to: addr, data }, "latest"],
  }));
const responses = await Promise.all(
  tokens.map((t) =>
    Functions.makeHttpRequest({
      url: `https://${t.chain}.infura.io/v3/357d367444db45688746488a06064e7c`,
      method: "POST",
      data: buildCalls(t.address, args[0]),
    })
  )
);
const [totalSupplySum, balanceSum] = [0, 1].map((callIdx) =>
  responses.reduce((sum, r) => sum + BigInt(r.data[callIdx].result || 0n), 0n)
);
return new Uint8Array([
  ...u256ToBytes(totalSupplySum),
  ...u256ToBytes(balanceSum),
]);
