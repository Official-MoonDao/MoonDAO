import Image from 'next/image'
import Link from 'next/link'

export default function SweepstakesHighlights() {
  return (
    <div>
      <p className="mt-5 bg-[#CBE4F7] text-[#1F212B] dark:bg-[#D7594F36] dark:text-white px-2 py-2 xl:py-3 xl:px-4 w-full xl:w-[95%] xl:text-left text-sm xl:text-base">
        MoonDAO is sending regular people to space as one small step in our
        mission to accelerate a multiplanetary future for all.
      </p>

      {/* Highlighting Astronauts */}
      <div className="mt-10 flex flex-col lg:flex-row items-center">
        <div className="lg:w-1/3">
          <Image
            src="/assets/coby-cotton.png"
            alt="Coby Cotton"
            className="rounded-full float-right w-full h-auto"
            width={400}
            height={400}
          />
        </div>
        <div className="mt-4 lg:mt-0 lg:w-2/3 px-4">
          <h2 className="text-xl font-bold">
            Coby Cotton: MoonDAO's First Astronaut
          </h2>
          <p className="mt-3 text-[#1F212B] dark:text-white px-2 py-2 xl:py-3 xl:px-4 text-sm xl:text-base">
            Coby is one of the five cofounders of the YouTube channel Dude
            Perfect, the most-subscribed sports channel on YouTube and one of
            the most popular in the world with more than 57 million followers.
            He co-founded the sports entertainment channel known for
            specializing in trick shots and comedy videos in 2009 with his
            college roommates.
          </p>
          <p className="mt-3 text-[#1F212B] dark:text-white px-2 py-2 xl:py-3 xl:px-4 text-sm xl:text-base">
            MoonDAO members voted to have Coby represent them on this flight and
            he flew as part of Blue Origin's NS-22 mission.{' '}
            <u>
              <Link
                href="https://www.youtube.com/watch?v=YXXlSG-du7c"
                target="_blank"
              >
                Watch the launch video
              </Link>
            </u>
            .
          </p>
        </div>
      </div>

      <div className="mt-10 flex flex-col lg:flex-row items-center">
        <div className="lg:w-1/3 order-1 lg:order-2">
          <Image
            src="/assets/eiman-jahangir.png"
            alt="Dr. Eiman Jahangir"
            className="rounded-full float-left w-full h-auto"
            width={400}
            height={400}
          />
        </div>
        <div className="mt-4 lg:mt-0 lg:w-2/3 order-1 px-4">
          <h2 className="text-xl font-bold">
            Dr. Eiman Jahangir: MoonDAO's Second Astronaut
          </h2>
          <p className="mt-3 text-[#1F212B] dark:text-white px-2 py-2 xl:py-3 xl:px-4 text-sm xl:text-base">
            Dr. Eiman Jahangir is a Cardiologist and Associate Professor of
            Medicine and Radiology at Vanderbilt University Medical Center,
            where he treats patients with heart disease and educates future
            physicians. Outside of medicine, he has a passion for exploration,
            including a lifelong dream of going to space. Over the past two
            decades, Eiman has been a NASA astronaut candidate finalist twice,
            participated in analog astronaut missions, and trained in various
            aspects of human spaceflight.
          </p>
          <p className="mt-3 text-[#1F212B] dark:text-white px-2 py-2 xl:py-3 xl:px-4 text-sm xl:text-base">
            Eiman is a long-time member of MoonDAO was selected via the Ticket to Space sweepstakes, flying to space as part of Blue Origin's NS-26 mission.{' '}
            <u>
              <Link
                href="https://www.youtube.com/watch?v=O8Z5HVXOwsk"
                target="_blank"
              >
                Watch the launch video
              </Link>
            </u>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
