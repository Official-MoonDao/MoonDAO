import React, { ReactNode } from 'react';
import Container from '../components/layout/Container';
import ContentLayout from '../components/layout/ContentLayout';

const ThankYou: React.FC = () => {
    return (
        <section className="overflow-auto">
            <Container>
                <ContentLayout
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
            </Container>
        </section>    
    );
}

export default ThankYou;
