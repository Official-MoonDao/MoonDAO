import React, { useState, useEffect, useContext } from 'react';
import { Arbitrum, Sepolia } from '@thirdweb-dev/chains';
import { NFT, useContract, useNFTs } from '@thirdweb-dev/react';
import { CITIZEN_ADDRESSES, ENTITY_ADDRESSES } from 'const/config';
import { blockedCitizens, blockedEntities, featuredEntities } from 'const/whitelist';
import { useRouter } from 'next/router';
import ChainContext from '../lib/thirdweb/chain-context';
import { useHandleRead } from '@/lib/thirdweb/hooks';
import { useShallowQueryRoute } from '@/lib/utils/hooks';
import Head from '../components/layout/Head';
import EntityCitizenCard from '@/components/directory/EntityCitizenCard';
import Tab from '@/components/layout/Tab';
import Container from '../components/layout/Container';
import ContentLayout from '../components/layout/ContentLayout';
import PreFooter from '../components/layout/PreFooter';
import Card from '../components/layout/Card';
import { SearchIcon } from '@/components/assets'
import Image from 'next/image';
import Frame from '../components/layout/Frame';
import InnerPreFooter from '../components/layout/InnerPreFooter';

export default function Directory() {
  const { selectedChain, setSelectedChain }: any = useContext(ChainContext);
  const router = useRouter();
  const shallowQueryRoute = useShallowQueryRoute();

  const [input, setInput] = useState('');
  function filterBySearch(nfts: NFT[]) {
    return nfts.filter((nft) => {
      return nft.metadata.name
        ?.toString()
        .toLowerCase()
        .includes(input.toLowerCase());
    });
  }

  const [tab, setTab] = useState<string>('all');
  function loadByTab(tab: string) {
    if (tab === 'entities') {
      setCachedNFTs(
        input != '' ? filterBySearch(filteredEntities) : filteredEntities
      );
    } else if (tab === 'citizens') {
      setCachedNFTs(
        input != '' ? filterBySearch(filteredCitizens) : filteredCitizens
      );
    } else {
      const nfts =
        filteredEntities?.[0] && filteredCitizens?.[0]
          ? [...filteredEntities, ...filteredCitizens]
          : filteredCitizens?.[0]
          ? filteredCitizens
          : filteredEntities?.[0]
          ? filteredEntities
          : [];
      setCachedNFTs(input != '' ? filterBySearch(nfts) : nfts);
    }
    // shallowQueryRoute({ type: tab })
  }

  // Citizen and Entity Data
  const { contract: entityContract } = useContract(
    ENTITY_ADDRESSES[selectedChain.slug]
  );
  const { contract: citizenContract } = useContract(
    CITIZEN_ADDRESSES[selectedChain.slug]
  );

  const { data: totalEntities } = useHandleRead(entityContract, 'totalSupply');
  const { data: totalCitizens } = useHandleRead(citizenContract, 'totalSupply');

  const [maxPage, setMaxPage] = useState(1);

  
  useEffect(() => {
    if (!totalEntities || !totalCitizens) return;
    if (tab === 'entities') setMaxPage(Math.ceil(totalEntities?.toNumber() / 9));
    if (tab === 'citizens') setMaxPage(Math.ceil(totalCitizens?.toNumber() / 9));
    if (tab === 'all')
      setMaxPage(
        Math.ceil((totalEntities.toNumber() + totalCitizens.toNumber()) / 9)
      );
  }, [totalEntities, totalCitizens, tab]);

  const [cachedNFTs, setCachedNFTs] = useState<NFT[]>([]);

  const {
    data: entities,
    isLoading: isLoadingEntities,
    error,
  } = useNFTs(entityContract, { start: 0, count: 100 });

  const { data: citizens, isLoading: isLoadingCitizens } = useNFTs(
    citizenContract,
    { start: 0, count: 100 }
  );

  const [filteredEntities, setFilteredEntities] = useState<NFT[]>([]);
  const [filteredCitizens, setFilteredCitizens] = useState<NFT[]>([]);

  const [pageIdx, setPageIdx] = useState(1);

  useEffect(() => {
    const type = router.query.type;
    if (type) {
      setTab(type as string);
    }
  }, [router]);

  //only show public nfts that are whitelisted
  useEffect(() => {
    if (entityContract) {
      const filteredPublicEntities: any = entities?.filter(
        (nft: any) =>
          nft.metadata.attributes?.find(
            (attr: any) => attr.trait_type === 'view'
          ).value === 'public' && !blockedEntities.includes(nft.metadata.id)
      );

      const now = Math.floor(Date.now() / 1000);

      const filteredValidEntities: any = filteredPublicEntities?.filter(
        async (nft: any) => {
          const expiresAt = await entityContract.call('expiresAt', [
            nft?.metadata?.id,
          ]);

          return expiresAt.toNumber() > now;
        }
      );

      setFilteredEntities(filteredValidEntities);
    }
  }, [entities, entityContract]);

  useEffect(() => {
    if (citizenContract) {
      const filteredPublicCitizens: any = citizens?.filter(
        (nft: any) =>
          nft.metadata.attributes?.find(
            (attr: any) => attr.trait_type === 'view'
          ).value === 'public' && !blockedCitizens.includes(nft.metadata.id)
      );
      const now = Math.floor(Date.now() / 1000);

      const filteredValidCitizens: any = filteredPublicCitizens?.filter(
        async (nft: any) => {
          const expiresAt = await citizenContract.call('expiresAt', [
            nft?.metadata?.id,
          ]);

          return expiresAt.toNumber() > now;
        }
      );
      setFilteredCitizens(filteredValidCitizens);
    }
  }, [citizens, citizenContract]);

  useEffect(() => {
    loadByTab(tab);
  }, [tab, input, filteredEntities, filteredCitizens, router.query]);

  useEffect(() => {
    if (router.query.type || router.asPath === '/directory')
      shallowQueryRoute({ type: tab });
  }, [tab]);

  useEffect(() => {
    setSelectedChain(
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
    );
  }, []);

  const descriptionSection = (
    <>
      <Frame
        bottomLeft='20px'
        topLeft='5vmax'
        marginBottom='10px'
        noPadding
        >
        <div className="relative px-4 bg-search w-full max-w-[350px] flex items-center space-x-2 text-black dark:text-white"
          >
          <div id="search-icon-bg"
            className="bg-search">
            
          </div>
          <Image src="/../.././assets/icon-mag.svg" alt="Search Icon" width={20} height={20} />
          <div id="input-field-container"
            className=""
            >
            <Frame
              noPadding
              marginBottom='0px'
              >
              <input
                className="w-full rounded-sm px-4 pt-2 pb-4 bg-dark-cool text-white placeholder:text-grey"
                onChange={({ target }) => setInput(target.value)}
                value={input}
                type="text"
                name="search"
                placeholder="Search..."
              />          
            </Frame>
          </div>  
        </div>
      </Frame>  
      <div id="filter-container" 
        className="max-w-[350px] border-b-5 border-black">
        <Frame
          noPadding   
          >
          <div className="flex flex-wrap text-sm bg-filter">
            <Tab tab="all" currentTab={tab} setTab={setTab}
              icon="/../.././assets/icon-star.svg"
              >
              All
            </Tab>
            <Tab tab="entities" currentTab={tab} setTab={setTab}
              icon="/../.././assets/icon-org.svg"
              >
              Teams
            </Tab>
            <Tab tab="citizens" currentTab={tab} setTab={setTab}
              icon="/../.././assets/icon-passport.svg"
              >
              Citizens
            </Tab>
          </div>
        </Frame>  
      </div>
    </>
  );

  return (
    <section id="network-container"
      className="overflow-hidden"
      >
      <Container>
        <ContentLayout
          header="Our Network"
          headerSize="max(20px, 3vw)"
          description={descriptionSection}
          preFooter={<InnerPreFooter/>}
          mainPadding
          mode="compact"
          popOverEffect={false}
        >
          <>
            <div id="card-grid-container"
              className="h-full mb-10 grid grid-cols-1 min-[1100px]:grid-cols-2 min-[1450px]:grid-cols-3 mt-5 gap-5 items-start"
              >
              {isLoadingEntities && 
              <p className="flex justify-center text-center min-h-[600px]"
                >
                Loading...
              </p>
              }
              {cachedNFTs
              ?.slice((pageIdx - 1) * 9, pageIdx * 9)
              .map((nft: any, I: number) => {
                if (nft.metadata.name !== 'Failed to load NFT metadata') {
                  const type = nft.metadata.attributes.find(
                    (attr: any) => attr.trait_type === 'communications'
                  )
                    ? 'entity'
                    : 'citizen';
                  return (
                    <div key={'entity-citizen-' + I}>
                      <Card
                        inline
                        metadata={nft.metadata}
                        owner={nft.owner}
                        type={type}
                        hovertext='Explore Profile'
                      />
                    </div>
                  );
                }
              })}
            </div>
            <Frame 
                noPadding
                marginBottom='0px'
              >        
              <div id="pagination-container" 
                className="w-full flex font-GoodTimes text-2xl flex-row justify-center lg:justify-start lg:space-x-8"
                >
                {pageIdx === 1 ? (
                <p></p>
                ) : (
                <button
                  onClick={() => {
                    if (pageIdx > 1) {
                      setPageIdx(pageIdx - 1);
                    }
                  }}
                  >
                  <Image src="/../.././assets/icon-left.svg" alt="Right Arrow" width={35} height={35} />
                </button>
                )}
                <p id="page-number"
                  className="px-5"
                  >
                  {pageIdx}
                </p>
                <button
                  onClick={() => {
                    if (pageIdx < maxPage) {
                      setPageIdx(pageIdx + 1);
                    }
                  }}
                  >
                  <Image src="/../.././assets/icon-right.svg" alt="Right Arrow" width={35} height={35} />
                </button>
              </div>
            </Frame>  
          </>
        </ContentLayout>
      </Container>
    </section>    
  );
}