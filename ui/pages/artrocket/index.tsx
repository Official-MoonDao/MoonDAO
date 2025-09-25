import Image from 'next/image'
import Link from 'next/link'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import WebsiteHead from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

export default function ArtRocket() {
  return (
    <Container>
      <WebsiteHead
        title="Art Rocket Brazil"
        description="Art Rocket Project Brazil Contest: Attend the Launch"
      />
      <ContentLayout
        header={'Art Rocket Project Brazil Contest: Attend the Launch'}
        description={
          <p>
            Inspired by the success of the MoonDAO and Unity Foundation Art
            Rocket Project in Brazil, we're excited to launch a contest that
            carries forward its legacy and{' '}
            <span className="font-bold font-sans">
              gives you the chance to attend the rocket launch in person in
              Kazakhstan!
            </span>{' '}
            The Art Rocket Project in Brazil combined space exploration with art
            therapy for oncology patients, culminating with their artwork set to
            be launched on a Soyuz rocket from Baikonur Cosmodrome (22-29
            November 2025).
            <br />
            <br />
            Now, it's your turn to dream big and propose the next innovative
            project for MoonDAO, while joining an unforgettable trip to witness
            the Soyuz Art Rocket launch live at Baikonur Cosmodrome in
            Kazakhstan!
          </p>
        }
        headerSize="max(20px, 3vw)"
        preFooter={<NoticeFooter />}
        mainPadding
        mode="compact"
        popOverEffect={false}
        isProfile
      >
        <div className="space-y-6">
          <div className="space-y-6">
            <section className="bg-gradient-to-br from-gray-900/40 via-blue-900/20 to-purple-900/10 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all duration-300">
              <div className="lg:float-left lg:w-1/2 lg:mr-6 lg:mb-4 mb-6">
                <Image
                  className="w-full h-full max-w-[800px] max-h-[800px] rounded-xl"
                  src="/assets/baikonur_launch.png"
                  alt="Baikonur Launch"
                  width={800}
                  height={800}
                />
              </div>

              <h2 className="text-2xl font-bold mb-4 text-white">
                About the Inspiration: Art Rocket Project in Brazil
              </h2>
              <p className="text-gray-300 leading-relaxed">
                The Art Rocket Project (MDP-181) brought hope to over 500
                oncology patients through art therapy workshops in Rio de
                Janeiro, Natal, Brasília and Foz do Iguacu. Patients' drawings
                of their dreams will be incorporated into a collage on this
                Soyuz rocket, symbolizing the intersection of space dreams and
                human resilience.
              </p>
              <p className="text-gray-300 leading-relaxed mt-4">
                Led by MoonDAO and the Unity Foundation, and accompanied by
                astronaut and cardiologist Eiman Jahangir and Russian cosmonaut
                Denis Matveev, the mission partnered with local universities, an
                analog station, and hospitals or clinics around Brazil to
                promote democratizing access to space while addressing social
                issues like cancer support. This project exemplifies MoonDAO's
                mission to unite space innovation with global social impact.
              </p>

              <div className="clear-both"></div>
            </section>

            <section className="bg-gradient-to-br from-gray-900/40 via-blue-900/20 to-purple-900/10 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all duration-300">
              <h2 className="text-2xl font-bold mb-4 text-white">
                Contest Details
              </h2>
              <p className="text-gray-300 leading-relaxed">
                Building on this legacy, submit your idea for MoonDAO's next
                major project. Your idea should innovatively blend:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-2 text-gray-300">
                <li>
                  <strong className="font-sans">Space exploration:</strong>{' '}
                  Elements from the space sector, such as research, science,
                  technology, education and even art.
                </li>
                <li>
                  <strong className="font-sans">Social impact:</strong> Tackling
                  a key social issue, like health, education, environmental
                  challenges, or community empowerment.
                </li>
                <li>
                  <strong className="font-sans">Country focus:</strong> Centered
                  on a specific country or region to amplify reach and relevance
                  with the theme of international collaboration.
                </li>
              </ul>
            </section>

            <section className="bg-gradient-to-br from-gray-900/40 via-blue-900/20 to-purple-900/10 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all duration-300">
              <h2 className="text-2xl font-bold mb-4 text-white">
                Submission Requirements
              </h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-300">
                <li>
                  <strong className="font-sans">Project Description:</strong> A
                  concise written summary of your idea (maximum 500 words),
                  outlining the concept, integration of themes, and expected
                  impact.
                </li>
                <li>
                  <strong className="font-sans">Short Video:</strong> A 2–3
                  minute video pitch explaining your project posted on social
                  media and tagging MoonDAO, its inspiration from the Art Rocket
                  Project, and why it deserves to be MoonDAO's next venture.
                </li>
                <li>
                  All contestants must be MoonDAO citizens by the submission
                  deadline.
                </li>
              </ul>
            </section>

            <section className="bg-gradient-to-br from-gray-900/40 via-blue-900/20 to-purple-900/10 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all duration-300">
              <h2 className="text-2xl font-bold mb-4 text-white">Deadline</h2>
              <p className="text-gray-300 leading-relaxed">
                All entries must be submitted by{' '}
                <strong className="text-blue-300">October 2, 2025</strong>.
              </p>
            </section>

            <section className="bg-gradient-to-br from-gray-900/40 via-blue-900/20 to-purple-900/10 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all duration-300">
              <h2 className="text-2xl font-bold mb-4 text-white">
                How to Submit
              </h2>
              <p className="text-gray-300 leading-relaxed">
                Send your written statement and a link to your video posted on
                social media to{' '}
                <Link
                  href="mailto:info@moondao.com"
                  className="text-blue-300 hover:underline"
                >
                  info@moondao.com
                </Link>
                . Make sure your idea aligns with MoonDAO's ethos of making
                space accessible to all while creating positive change on Earth,
                and make sure to tag MoonDAO.
              </p>
              <p className="text-gray-300 leading-relaxed mt-4">
                This contest is your chance to extend the Art Rocket Project's
                legacy, propose ideas that inspire, unite, and propel humanity
                forward. Enter now for a chance to join us at the launch!
              </p>
              <p className="text-gray-300 leading-relaxed mt-4">
                In the event of more than 10 submissions, a selection committee
                will determine the top 10 candidates who will go up for a vote
                by MoonDAO Members to determine the finalist and runners-up.
              </p>
            </section>

            <section className="bg-gradient-to-br from-gray-900/40 via-blue-900/20 to-purple-900/10 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all duration-300">
              <h2 className="text-2xl font-bold mb-4 text-white">
                Prize Details
              </h2>
              <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                <ul className="list-disc pl-6 space-y-3 text-gray-300">
                  <li>
                    <strong className="text-green-300">
                      MoonDAO will provide up to $1,200
                    </strong>{' '}
                    to partially cover travel expenses to Moscow, Russia, where
                    the selected applicant will spend 2 days exploring the city
                    before heading to Baikonur.
                  </li>
                  <li>
                    <strong className="text-green-300">
                      Our partners will cover
                    </strong>{' '}
                    the round-trip travel from Moscow to Baikonur, including 5
                    days at the Baikonur Cosmodrome with hotel accommodations,
                    meals, and a special program included.
                  </li>
                </ul>
              </div>
            </section>
          </div>

          <div className="clear-both"></div>
        </div>
      </ContentLayout>
    </Container>
  )
}
