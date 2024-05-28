import React, { ReactNode } from 'react';
import Body from '../components/layout/Body';
import Content from '../components/layout/Content';

const AlmostThere: React.FC = () => {
    return (
        <section>
            <Body fullWidth>
                <Content
                    header="Almost There..."
                    headerSize="max(25px, 2.5vw)" 
                    description={
                        <>
                            Check your email to confirm your subscription. 
                        </>
                    }
                />
            </Body>
        </section>    
    );
}

export default AlmostThere;
