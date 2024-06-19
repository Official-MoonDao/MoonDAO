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
        <div
            style={frameStyle}
            className={`overflow-hidden w-full ${noPadding ? "" : "p-5 pb-0 md:p-10"}`}
        >
            {children}
        </div>
    );
}