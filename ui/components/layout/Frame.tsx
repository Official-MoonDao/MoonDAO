import { ReactNode, CSSProperties } from "react";

interface RoundedFrameProps {
    children?: ReactNode;
    topLeft?: string;
    topRight?: string;
    bottomLeft?: string;
    bottomRight?: string;
    backgroundColor?: string;
    noPadding?: boolean;
    marginTop?: string;
    marginRight?: string;
    marginBottom?: string;
    marginLeft?: string;
    className?: string; 
}

export default function RoundedFrame({
    children,
    topLeft = "20px",
    topRight = "5vmax",
    bottomLeft = "5vmax",
    bottomRight = "5vmax",
    backgroundColor = "transparent",
    noPadding = false,
    marginTop = "0px",
    marginRight = "0px",
    marginBottom = "20px",
    marginLeft = "0px",
    className = "", 
}: RoundedFrameProps) {
    const frameStyle: CSSProperties = {
        backgroundColor,
        borderRadius: `${topLeft} ${topRight} ${bottomRight} ${bottomLeft}`,
        marginTop,
        marginRight,
        marginBottom,
        marginLeft,
    };

    return (
        <div id="frame-container"
            style={frameStyle}
            className={`
                overflow-hidden
                ${noPadding ? "" : "p-5 pb-0 md:p-10"} 
                ${className && className }
            `} 
            >
            {children}
        </div>
    );
}