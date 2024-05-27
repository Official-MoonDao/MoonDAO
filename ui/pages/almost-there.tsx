import React, { ReactNode } from 'react';
import Body from '../components/layout/Body';
import Content from '../components/layout/Content';
import Container from '../components/layout/Container'; 

interface ContainerProps {
    children: ReactNode;
}

const ThankYou: React.FC = () => {
    return (
        <section>
            <Body>
                <Content
                    header="Almost There..."
                    headerSize="max(25px, 3vw)" 
                    subHeader="Check your email to confirm your subscription"
                    children={<Container>Check your email to confirm your subscription.</Container>}
                />
            </Body>
        </section>    
    );
}

export default ThankYou;
