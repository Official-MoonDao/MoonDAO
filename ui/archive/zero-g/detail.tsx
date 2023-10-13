import { useRouter } from 'next/router'
import WebsiteHead from '../../components/layout/Head'

export default function ZeroGDetail() {
  const router = useRouter()
  return (
    <div className="flex flex-col justify-center items-center text-center component-background py-12 lg:py-20 mt-3 w-[336px] rounded-2xl sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] border-detail-light dark:border-detail-dark border lg:border-2 shadow-md shadow-detail-light dark:shadow-detail-dark px-4">
      <WebsiteHead title="Zero-G Flight Details" />
      <h1 className="font-GoodTimes text-3xl lg:text-4xl 2xl:text-5xl mt-4 text-title-light dark:text-title-dark">
        Zero-G Flight Details
      </h1>
      <div className="mt-5 flex flex-col justif-center items-center backdropBlur">
        <p className="2xl:mt-3 text-xl lg:text-2xl font-GoodTimes text-detail-light dark:text-detail-dark opacity-80">
          June 9th | JSC, Houston, TX{' '}
        </p>
        <hr className="border-n3blue my-2 w-3/4"></hr>
        <button
          className="mt-4 font-GoodTimes text-2xl text-n3blue hover:scale-[1.05] ease-in-ease-out duration-300 "
          onClick={() => router.push('/zero-g')}
        >
          Book your Zero-G flight now! 🚀
        </button>
        <div className="mt-8 leading-relaxed flex flex-col gap-7 w-3/4 text-light-text dark:text-dark-text font-mono lg:text-lg lg:leading-loose">
          <p className="font-semibold font-display text-lg tracking-wide lg:tracking-widest">
            Are you ready to be a part of space history?
          </p>
          <p className="mt-5">
            Welcome to the ultimate space experience, brought to you by MoonDao
            and Space for a Better World. This is your chance to be part of
            something truly groundbreaking and make a difference in the future
            of space research.
          </p>
          <div className="flex flex-col gap-[20px]">
            <p>
              We believe that space exploration is the key to unlocking a better
              future for all of humanity. That's why we're inviting you to join
              us on an unforgettable journey, and help us build a
              self-sustaining, self-governing settlement on the Moon that will
              act as a launch point for humanity to explore the cosmos.
            </p>
            <p>
              Our mission is to create a more equitable and sustainable world,
              and we believe that the frontier of space is the greatest
              opportunity to achieve this. As a high profile individual who
              shares our values, we want to offer you the chance to be part of
              something truly special.
            </p>
          </div>
          <p>
            Your journey will begin with a tour of the Houston Space Center,
            where you'll get to meet with two NASA astronauts who will be
            joining us on our mission to the Moon. They'll share their
            incredible stories of what it's like to live and work in space, and
            give you a glimpse into what's in store for you on your journey.
          </p>
          <p>
            Then, it's time to take flight. Our zero gravity flight experience
            is unlike anything else you've ever experienced. You'll be
            weightless, floating freely in the cabin. And with MoonDao's
            cutting-edge experiments in the flight, you'll be part of something
            truly revolutionary.
          </p>
          <p>
            But this isn't just about the experience or a few experiments. We're
            inviting you to be part of our long term mission to the Moon. With
            your support, we can make this dream a reality, and help create a
            better world (and galaxy) for all of us.
          </p>
          <p>
            And that's not all. As a supporter of MoonDao and Space for a Better
            World, you'll have access to a community of like-minded individuals
            who share your passion for creating positive change in the world. We
            believe that by working together, we can achieve anything we set our
            minds to.
          </p>

          <p>
            So, are you ready to join us on this incredible journey? Let's make
            history together, and create a brighter future for all of humanity.
            Sign up now and be part of something truly extraordinary.
          </p>

          <p>
            P.S. Keep an eye out for our resident space enthusiast, who might
            just have some intergalactic jokes up their spacesuit sleeve!
          </p>
        </div>
        <button
          className="mt-10 flex items-center text-xl rounded px-3 py-1 hover:scale-105 ease-in duration-150 bg-moon-blue text-gray-100 hover:text-white dark:bg-stronger-dark"
          onClick={() => router.push('/zero-g')}
        >
          {'← Back'}
        </button>
      </div>
    </div>
  )
}
