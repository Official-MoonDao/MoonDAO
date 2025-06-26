export default function Video() {
    return (
        <section id="video-section" 
            className="relative gradient-6 lg:mt-[-110px] md:mt-[-50px] mt-[-60px] flex justify-center px-[20px] md:px-[40px]"
            >
            <div id="video-container" 
                className="max-w-[1200px] w-full"
                >
                <div id="video-wrapper" 
                    className="pt-[56.25%] relative rounded-lg z-40"
                    >
                    <iframe id="video" 
                        className="absolute left-0 rounded-[20px] top-0 bg-dark-cool" 
                        src="https://player.vimeo.com/video/944146258?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479" 
                        allowFullScreen 
                        width="100%" height="100%" 
                        allow="fullscreen" 
                    />
                </div>
            </div>
            <div 
                className="bg-white absolute bottom-0 w-full left-0 lg:h-[150px] md:h-[100px] h-[100px] rounded-tl-[2vmax]"
            ></div>
        </section>
    )
}
