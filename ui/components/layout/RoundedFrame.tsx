import { ReactNode } from "react";

interface RoundedFrameProps {
    children?: ReactNode;
}

export default function RoundedFrame({ children }: RoundedFrameProps) {
    return (
        <div className="rounded-[5vmax] rounded-tl-[20px] overflow-hidden">
            {children}
        </div>
    );
}