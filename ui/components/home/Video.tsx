export default function Video() {
    return (
        <div className="VIDEO-SECTION-CONTAINER relative">
            <div className="gradient-6 h-full w-full">
                <div className="VIDEO-SECTION lg:mt-[-10vh] max-w-[1200px] md:mt-[-10vh] md:p-10 md:pb-0 mt-[-8vh] p-5 pb-0 pt-0 w-full">
                    <div className="VIDEO-CONTAINER pt-[56.25%] relative rounded-lg z-10">
                        <iframe className="VIDEO absolute left-0 rounded-[20px] top-0" width="100%" height="100%" src="https://player.vimeo.com/video/944146258?h=a765180cf1" frameBorder="0" allowFullScreen></iframe>
                    </div>
                </div>
            </div>
        </div>
    )
}
