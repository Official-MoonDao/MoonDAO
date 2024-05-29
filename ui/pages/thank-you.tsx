import React, { ReactNode } from 'react';
import Body from '../components/layout/Body';
import Content from '../components/layout/Content';

const ThankYou: React.FC = () => {
    return (
        <section className="overflow-auto">
            <Body fullWidth>
                <Content
                    header="Thank You"
                    headerSize="max(25px, 4vw)"
                    description={
                        <>
                            We've received your response. <br></br>
                            <a href="/" className="text-white underline">
                                CLICK HERE
                            </a> 
                            &nbsp; to go back to the homepage.
                        </>
                    }
                />
            </Body>
        </section>    
    );
}

export default ThankYou;
