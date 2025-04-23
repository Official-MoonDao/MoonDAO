const userAddress = args[0];
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
                    // The signature of 'balanceOf(address)' + the user address without the 0x prefix
                    data:
                        "0x70a08231000000000000000000000000" +
                        userAddress.slice(2),
                },
                "latest",
            ],
        },
    });
});
const responses = await Promise.all(requests);
const balances = responses.map((response) => {
    return parseInt(response.data.result, 16) ?? 0;
});
const totalBalance = balances.reduce((a, b) => a + b, 0);
return Functions.encodeUint256(totalBalance);
