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
                    data: "0x18160ddd",
                },
                "latest",
            ],
        },
    });
});
const responses = await Promise.all(requests);
const supplys = responses.map((response) => {
    return parseInt(response.data.result, 16) ?? 0;
});
const totalSupply = supplys.reduce((a, b) => a + b, 0);
return Functions.encodeUint256(totalSupply);
