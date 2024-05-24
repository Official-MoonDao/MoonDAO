export default function Video() {
    return (
        <div className="VIDEO-SECTION-CONTAINER relative">
            <div className="gradient-6 h-full w-full">
                <div className="VIDEO-SECTION lg:mt-[-10vh] max-w-[1200px] md:mt-[-10vh] md:p-10 md:pb-0 mt-[-8vh] p-5 pb-0 pt-0 w-full">
                    <div className="VIDEO-CONTAINER pt-[56.25%] relative rounded-lg z-10">
                    <iframe
            className="VIDEO absolute left-0 rounded-[20px] top-0"
            src="https://player.vimeo.com/video/944146258?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479"
            allowFullScreen
            width="100%"
            height="500"
            allow="fullscreen"
          />
                    </div>
                </div>
            </div>
        </div>
    )
}
