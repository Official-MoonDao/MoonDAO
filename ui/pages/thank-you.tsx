import React, { ReactNode } from 'react';
import Body from '../components/layout/Body';
import Content from '../components/layout/Content';
import Container from '../components/layout/Container'; 

interface MainSectionProps {
    children: ReactNode;
}

const ThankYou: React.FC = () => {
    return (
        <section>
            <Body>
                <Content
                    header="Thank You"
                    headerSize="max(25px, 4vw)"
                    subHeader="We've received your response. We've received your response. We've received your response. We've received your response. We've received your response. We've received your response. We've received your response. We've received your response. We've received your response. We've received your response. We've received your response. We've received your response. We've received your response. "
                />
            </Body>
        </section>    
    );
}

export default ThankYou;
