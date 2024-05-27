export default function Video() {
    return (
        <section id="video-section" className="relative">
            <div id="background-gradient" className="gradient-6 h-full w-full">
                <div id="video-container" className="lg:mt-[-10vh] max-w-[1200px] md:mt-[-20vh] md:p-10 md:pb-0 mt-[-8vh] p-5 pb-0 pt-0 w-full">
                    <div id="video-wrapper" className="pt-[56.25%] relative rounded-lg z-10">
                        <iframe id="video" className="absolute left-0 rounded-[20px] top-0" src="https://player.vimeo.com/video/944146258?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479" allowFullScreen width="100%" height="100%" allow="fullscreen" />
                    </div>
                </div>
            </div>
        </section>
    )
}
