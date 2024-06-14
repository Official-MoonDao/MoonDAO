import React, { ReactNode } from 'react';
import Container from '../components/layout/Container';
import ContentLayout from '../components/layout/ContentLayout';

const Constitution: React.FC = () => {
    return (
        <section className="overflow-auto">
            <Container>
                <ContentLayout
                    header="Thank You"
                    headerSize="max(25px, 4vw)"
                    subHeader="We've received your response. We've received your response. We've received your response. We've received your response. We've received your response. We've received your response. We've received your response. We've received your response. We've received your response. "
                />
            </Container>
        </section>    
    );
}

export default Constitution;
