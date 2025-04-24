function uint256ToBytes(uint256) {
  const bytes = new Array(32).fill(0); // 32 bytes for uint256
  let value = BigInt(uint256);
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return bytes;
}
const tokens = [
  {
    rpc: secrets.ETH_RPC,
    address: "0xCc71C80d803381FD6Ee984FAff408f8501DB1740",
  },
  {
    rpc: secrets.ARB_RPC,
    address: "0xB255c74F8576f18357cE6184DA033c6d93C71899",
  },
  {
    rpc: secrets.POLY_RPC,
    address: "0xe2d1BFef0A642B717d294711356b468ccE68BEa6",
  },
  {
    rpc: secrets.BASE_RPC,
    address: "0x7f8f1B45c3FD6Be4F467520Fc1Cf030d5CaBAcF5",
  },
];
async function getRequests(data) {
  const requests = tokens.map((token, index) => {
    return Functions.makeHttpRequest({
      url: token.rpc,
      method: "POST",
      data: {
        id: index,
        jsonrpc: "2.0",
        method: "eth_call",
        params: [
          {
            to: token.address,
            // The signature of 'totalSupply'
            data: data,
          },
          "latest",
        ],
      },
    });
  });
  const responses = await Promise.all(requests);
  const results = responses.map((response) => {
    //return parseInt(response.data.result, 16) ?? 0;
    console.log(response);
    return parseInt(0, 16) ?? 0;
  });
  const sum = results.reduce((a, b) => a + b, 0);
  return uint256ToBytes(sum);
}
const supplyBytes = await getRequests("0x18160ddd"); // totalSupply
const balanceBytes = await getRequests(
  "0x70a08231000000000000000000000000" + args[0].slice(2)
); // balanceOf(address)
const packed = [...supplyBytes, ...balanceBytes]; // 64 bytes total, aka uint8[64]
return packed;
