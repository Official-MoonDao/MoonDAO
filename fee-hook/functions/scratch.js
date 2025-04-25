const tokens = [];
const u256ToBytes = (n) =>
  Array.from({ length: 32 }, (_, i) =>
    Number((n >> (8n * BigInt(31 - i))) & 0xffn)
  );
const buildCalls = (addr, usr) =>
  [
    "0x18160ddd", // totalSupply()
    `0x70a08231${usr.slice(2).padStart(64, "0")}`, // balanceOf(usr)
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
return Functions.encodeString("hello");
