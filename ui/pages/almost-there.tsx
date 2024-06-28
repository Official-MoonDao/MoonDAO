import React, { ReactNode } from 'react';
import Container from '../components/layout/Container';
import ContentLayout from '../components/layout/ContentLayout';

const AlmostThere: React.FC = () => {
    return (
        <section>
            <Container 
                containerFullWidth>
                <ContentLayout
                    header="Almost There..."
                    headerSize="max(25px, 2.5vw)" 
                    description={
                        <>
                            Check your email to confirm your subscription. 
                        </>
                    }
                />
            </Container>
        </section>    
    );
}

export default AlmostThere;
