import { HatsSubgraphClient } from '@hatsprotocol/sdk-v1-subgraph'

const hatsSubgraphClient = new HatsSubgraphClient({
  config: {
    [42161]: {
      endpoint: `https://gateway-arbitrum.network.thegraph.com/api/${process.env.THE_GRAPH_API_KEY}/subgraphs/id/4CiXQPjzKshBbyK2dgJiknTNWcj8cGUJsopTsXfm5HEk`,
    },
    [11155111]: {
      endpoint: `https://api.studio.thegraph.com/query/1748116/moondao-hats-v-1-sepolia/v0.0.1`,
    },
  },
})

export default hatsSubgraphClient

//a881411e2217bd893e5373d8325999e7
