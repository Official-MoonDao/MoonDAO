import Link from 'next/link'
import FAQs from '../layout/FAQs'

const FAQS = [
  {
    question: 'Who can use the Launchpad?',
    answer: (
      <>
        Teams in the{' '}
        <Link href="/join" className="text-blue-500 underline">
          Space Acceleration Network
        </Link>{' '}
        can create Missions directly and permissionlessly, but anyone with a
        space-related project can apply to create their mission with the
        Launchpad—whether it's a research initiative, satellite deployment,
        lunar lander payload, or even a human spaceflight mission—in order to
        start raising funds. Apply now to tell us more about your objectives,
        fundraising goals, existing network, and how we can help.
      </>
    ),
  },
  {
    question: 'Why use blockchain for space crowdfunding?',
    answer:
      'Blockchain ensures transparency, security, and trust in fundraising as well as being open to a global audience in a borderless nature. Every transaction is recorded onchain, meaning full visibility for backers as to how funds are used, and offers unique opportunities for backers to continue interacting with the project, including through governance decision making via tokens, ongoing stakeholding, or even revenue share opportunities in some cases, all through transparent and auditable computer code.',
  },
  {
    question: 'Is this platform only for space startups?',
    answer:
      "The Launchpad is primarily designed for space-related ventures, but any high-tech, hard-science, or deep-tech project aligned with MoonDAO's mission to help create or advance a lunar settlement could potentially launch a campaign.",
  },
  {
    question: 'How much does it cost to launch a campaign?',
    answer:
      'There is no upfront cost to create a Mission, but standard Ethereum network (gas) fees apply when deploying smart contracts. Additionally, MoonDAO/Juicebox receive a small percentage (10% in total) of successfully raised funds to sustain the platform and support other space related projects within the community governed treasury. Likewise, 10% of the tokens created for a Mission will be reserved for the MoonDAO treasury to align long term interests, with a 1-year cliff and three years streaming, meaning that tokens cannot be immediately sold. Furthermore, any outlays from the MoonDAO treasury require a vote.',
  },
  {
    question: 'How does the cliff and streaming work?',
    answer:
      "Funds raised through the MoonDAO Launch Pad are subject to a 1-year cliff, meaning they remain locked for the first year. After this period, they stream gradually over three years, ensuring sustainable, long-term funding. This applies to both the project's funds and MoonDAO's 10% reserve allocation, preventing immediate sell-offs and promoting ecosystem stability.",
  },
  {
    question: 'Should I create an erc-20 token for my campaign?',
    answer:
      "It depends on your project's goals. An ERC-20 token can provide liquidity, community ownership, and governance features, but it also introduces risks like speculation and regulatory concerns. Tokens allow for tradability on decentralized exchanges, enabling supporters to buy, sell, or hold them as part of the project's ecosystem. They can also incentivize engagement through governance rights or utility within the project. However, speculative trading can create volatility, potentially impacting long-term sustainability.",
  },
  {
    question: 'Do I need to manage liquidity for my token?',
    answer:
      'If a mission launches successfully using an ERC-20 token, a liquidity pool (LP) will be created on Uniswap after the funding period ends. 2.5% of the raised ETH and 2.5% of the token supply will be added to the pool. Trading fees from the DEX will accrue to vMOONEY holders.',
  },
  {
    question: 'Can I fundraise in multiple cryptocurrencies?',
    answer:
      'Fundraising will be limited to the Ethereum Virtual Machine (EVM), but contributors can participate across Ethereum mainnet and Layer 2 networks, including Arbitrum, Base, and Polygon. This ensures broad accessibility while keeping transactions efficient and cost-effective while also tying into the existing Space Acceleration Network and MoonDAO infrastructure, and the wider EVM ecosystem.',
  },
  {
    question:
      'Can contributors withdraw their funds if they change their minds?',
    answer:
      "By default, if the team doesn't reach its funding goal by the deadline, contributors are refunded. If the fundraiser is successful, the team will be responsible for determining what to do with the treasury, including their policy on refunds if the mission cannot move forward.",
  },
  {
    question:
      'What are the tax and regulatory implications of fundraising with crypto?',
    answer:
      'Tax and regulatory requirements vary by jurisdiction, and funds raised through the Launchpad may be considered taxable income. Depending on local laws, you may need to report contributions, pay capital gains tax on held crypto, or comply with securities regulations if your token is classified as an investment. Some regions also require KYC/AML compliance for fundraising. Since regulations are constantly evolving, we strongly recommend consulting a crypto-savvy legal or tax professional to ensure compliance. MoonDAO does not provide legal or tax advice, and responsibility for compliance rests with campaign creators.',
  },
]

export default function LaunchpadFAQs() {
  return <FAQs faqs={FAQS} />
}
