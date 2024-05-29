import React from 'react';
import Body from '../components/layout/Body';
import Content from '../components/layout/Content';
import FooterSection from '../components/home/FooterSection';
import WebsiteHead from '../components/layout/Head'; 
import MailingList from '../components/layout/MailingList';

const LinkTree: React.FC = () => {
    const title = "Linktree";
    const description = "🚀 Get the latest news and updates from MoonDAO"; 
    const image = "../public/assets/MoonDAO-OG.jpg";

    return (
        <>
            <WebsiteHead title={title} description={description} image={image} />
            <section className="w-[calc(100vw-20px)]">
                <Body>
                    <Content
                        header="News & Updates"
                        headerSize="max(20px, 3vmax)"
                        description={
                            <>
                                <p className="pb-5 md:pb-0">
                                    Get the latest news and updates from MoonDAO
                                </p>
                                <MailingList /> 
                            </>
                        }
                        callout={
                            <>
                                <FooterSection />
                            </>
                        } 
                    >
                    <>
                        <img className="mb-5 rounded-[5vmax] rounded-tl-[20px]" src="../assets/dude-perfect.jpg" alt="Dude Perfect" />
                        <p>MoonDAO is an international collective of people united by the mission of decentralizing access to space research and exploration. Find out how to get involved and learn more about some of the exciting stuff we've got in the works!</p>
                    </>
                    </Content>
                </Body>
            </section>
        </>
    );
}

export default LinkTree;
