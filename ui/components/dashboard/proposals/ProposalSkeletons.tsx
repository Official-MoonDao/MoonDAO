import Proposal from "./Proposal";

const ProposalSkeletons = () => {
  const skeletonData = {
    title: "Loading MoonDAO members proposals. If loading takes too long, contact MoonDAO Discord.",
    author: "0x679d87D8640e66778c3419D164998E720D7495f6",
    body: "Loading MoonDAO members proposals. If loading takes too long, contact MoonDAO Discord. Loading MoonDAO members proposals. If loading takes too long, contact MoonDAO Discord. Loading MoonDAO members proposals. If loading takes too long, contact MoonDAO Discord. If loading takes too long, contact MoonDAO Discord.",
  };
  return (
    <>
      {Array(10)
        .fill(skeletonData)
        .map((e, i) => (
          <Proposal loading={true} key={i} idx={i} title={e.title} author={e.author} state="pending" body={e.body} />
        ))}
    </>
  );
};

export default ProposalSkeletons;
