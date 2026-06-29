import { GlobeAltIcon } from '@heroicons/react/24/outline'
import Container from '../layout/Container'
import ContentLayout from '../layout/ContentLayout'
import { ExpandedFooter } from '../layout/ExpandedFooter'
import StandardButton from '../layout/StandardButton'

type RegionRestrictedNoticeProps = {
  // Tailors the copy to the flow the visitor tried to enter.
  type?: 'citizen' | 'team'
}

/**
 * Shown to EU/EEA visitors who land on a flow that would permanently store
 * personal data on chain (citizen / team creation). GDPR prevents us from
 * offering on-chain profile creation in these regions, but visitors can still
 * explore the rest of the Space Acceleration Network.
 */
export default function RegionRestrictedNotice({
  type = 'citizen',
}: RegionRestrictedNoticeProps) {
  const profile = type === 'team' ? 'Team' : 'Citizen'

  return (
    <Container>
      <ContentLayout
        header="Not Available in Your Region"
        headerSize="max(20px, 3vw)"
        mainPadding
        mode="compact"
        popOverEffect={false}
        isProfile
        description={
          <>
            {`You're welcome to explore the Space Acceleration Network, but
            creating a ${profile} profile isn't available in your region right
            now.`}
          </>
        }
        preFooter={<ExpandedFooter hasCallToAction={false} />}
      >
        <div className="animate-fadeIn w-full flex flex-col items-center md:items-start text-white">
          <div className="mb-6 w-full max-w-[600px] rounded-2xl border border-slate-600/30 bg-gradient-to-r from-slate-700/30 to-slate-800/40 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/20">
                <GlobeAltIcon className="h-6 w-6 text-blue-300" />
              </div>
              <div className="space-y-3">
                <p className="text-base leading-relaxed text-slate-200">
                  {`Creating a ${profile} permanently writes profile data on
                  chain. To stay compliant with data protection regulations
                  (GDPR) in the EU and EEA, we don't offer on-chain profile
                  creation in your region yet.`}
                </p>
                <p className="text-base leading-relaxed text-slate-300">
                  You can still browse citizens and teams, explore the map, and
                  follow along with everything MoonDAO is building. We're working
                  to expand availability while staying compliant.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <StandardButton
                className="gradient-2 hover:opacity-90 transition-opacity"
                textColor="text-white"
                borderRadius="rounded-xl"
                hoverEffect={false}
                link="/network"
              >
                Explore the Network
              </StandardButton>
              <StandardButton
                backgroundColor="bg-white/5"
                hoverColor="hover:bg-white/10"
                textColor="text-white"
                borderRadius="rounded-xl"
                hoverEffect={false}
                link="https://discord.gg/moondao"
                target="_blank"
              >
                Get Updates on Discord
              </StandardButton>
            </div>
          </div>
        </div>
      </ContentLayout>
    </Container>
  )
}
