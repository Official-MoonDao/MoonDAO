import Image from 'next/image'
import Link from 'next/link'

export default function SweepstakesHighlights() {
  return (
    <div>
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
          <h2 className="text-xl font-bold text-white">
            Coby Cotton: MoonDAO's First Astronaut
          </h2>
          <div className="mt-3 bg-slate-800/30 border border-slate-600/30 backdrop-blur-lg text-white px-4 py-4 xl:py-6 xl:px-6 text-sm xl:text-base rounded-lg shadow-lg">
            Coby is one of the five cofounders of the YouTube channel Dude
            Perfect, the most-subscribed sports channel on YouTube and one of
            the most popular in the world with more than 57 million followers.
            He co-founded the sports entertainment channel known for
            specializing in trick shots and comedy videos in 2009 with his
            college roommates.
          </div>
          <div className="mt-3 bg-slate-800/30 border border-slate-600/30 backdrop-blur-lg text-white px-4 py-4 xl:py-6 xl:px-6 text-sm xl:text-base rounded-lg shadow-lg">
            MoonDAO members voted to have Coby represent them on this flight and
            he flew as part of Blue Origin's NS-22 mission.{' '}
            <u>
              <Link
                href="https://www.youtube.com/watch?v=YXXlSG-du7c"
                target="_blank"
                className="text-blue-300 hover:text-blue-200 transition-colors"
              >
                Watch the launch video
              </Link>
            </u>
            .
          </div>
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
          <h2 className="text-xl font-bold text-white">
            Dr. Eiman Jahangir: MoonDAO's Second Astronaut
          </h2>
          <div className="mt-3 bg-slate-800/30 border border-slate-600/30 backdrop-blur-lg text-white px-4 py-4 xl:py-6 xl:px-6 text-sm xl:text-base rounded-lg shadow-lg">
            Dr. Eiman Jahangir is a Cardiologist and Associate Professor of
            Medicine and Radiology at Vanderbilt University Medical Center,
            where he treats patients with heart disease and educates future
            physicians. Outside of medicine, he has a passion for exploration,
            including a lifelong dream of going to space. Over the past two
            decades, Eiman has been a NASA astronaut candidate finalist twice,
            participated in analog astronaut missions, and trained in various
            aspects of human spaceflight.
          </div>
          <div className="mt-3 bg-slate-800/30 border border-slate-600/30 backdrop-blur-lg text-white px-4 py-4 xl:py-6 xl:px-6 text-sm xl:text-base rounded-lg shadow-lg">
            Eiman is a long-time member of MoonDAO was selected via the Ticket
            to Space sweepstakes, flying to space as part of Blue Origin's NS-26
            mission.{' '}
            <u>
              <Link
                href="https://www.youtube.com/watch?v=O8Z5HVXOwsk"
                target="_blank"
                className="text-blue-300 hover:text-blue-200 transition-colors"
              >
                Watch the launch video
              </Link>
            </u>
            .
          </div>
        </div>
      </div>
    </div>
  )
}
