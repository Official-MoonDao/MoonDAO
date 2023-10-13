import gsap from 'gsap'
import { GetStaticPaths, GetStaticProps } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import WebsiteHead from '../../components/layout/Head'
import RuleTitle from '../../components/zero-g/RuleTitle'

export default function ZeroGDetail({ slug }: any) {
  const router = useRouter()
  const altEntryRef: any = useRef()
  const mainRef: any = useRef()
  useEffect(() => {
    if (altEntryRef.current && slug.some((s: any) => s === 'alt-entry')) {
      setTimeout(() => {
        altEntryRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 1000)

      setTimeout(() => {
        gsap.to(altEntryRef.current, {
          background: '#ffbc5c50',
          duration: 1,
        })
      }, 2000)
    } else {
      altEntryRef.current.style.background = 'transparent'
      if (mainRef.current)
        mainRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [altEntryRef, mainRef])
  return (
    <div
      className="flex flex-col justify-center items-center text-center md:w-[80%] card rounded-[15px] border-[0.5px] border-gray-300 bg-black bg-opacity-70 text-white font-RobotoMono shadow-md overflow-visible p-[5%]"
      ref={mainRef}
    >
      <WebsiteHead title="Zero-G Sweepstakes" />
      <h1
        className={`mt-5 card-title text-center font-GoodTimes text-3xl lg:text-4xl font-medium text-transparent bg-clip-text bg-gradient-to-tr from-n3blue to-amber-200`}
      >
        Zero-G Sweepstakes Rules
      </h1>
      <div className="flex flex-col justify-center items-center">
        <div className="my-8 flex flex-col gap-7 w-full leading-relaxed">
          <p>
            {`
            The MoonDAO™ ZeroG Sweepstakes (the “Promotion”) is sponsored by MoonDAO Limited d/b/a MoonDAO (“Sponsor”). By entering the Promotion, you agree to comply with and be bound by the following MoonDAO™ ZeroG Sweepstakes Rules (the “Rules”). Please review the Rules carefully. If you do not agree to the terms and conditions of the Rules in their entirety, you are not permitted to enter the Promotion. This Promotion may be canceled or postponed by Sponsor, at any time in its sole discretion.`}
          </p>
          <hr></hr>

          <RuleTitle title={'Eligibility'} />
          <p>
            {`
The Promotion is open only to individuals who are eighteen (18) years of age or older (or the applicable age of majority, if greater than eighteen (18) years of age in their respective jurisdictions) and that can enter into legally binding contracts under applicable law. The Promotion is expressly void in Florida, New York, Puerto Rico and where otherwise prohibited by law. Employees, officers and directors Zero Gravity Corporation (“ZeroG”), and each of the foregoing individuals’/entities’ respective parents, subsidiaries and affiliated companies, and each of their legal representatives, advertising, promotional, fulfillment and marketing agencies, and their immediate families (and those living in their respective households), are not eligible to participate or claim a Prize (as defined below) in the Promotion. Participation constitutes each entrant’s full and unconditional agreement to Sponsor’s decisions, which are final and binding in all matters related to the Promotion. Winning a Prize is contingent upon fulfilling all requirements set forth herein.`}
          </p>
          <hr></hr>
          <RuleTitle title={'LIMITED TIME ONLY'} />
          <p>
            {`
           The Promotion period (“Promotion Period”) begins at 8:00:00 a.m. Pacific Standard Time (“PST”) on March 29, 2023, and ends at 11:59:00 p.m. PST on April 30, 2023 (“Promotion End Date”). Entries must be received prior to the expiration of the Promotion Period to be eligible for a Prize.`}
          </p>
          <hr></hr>
          <RuleTitle title={'HOW TO ENTER'} />

          <p>
            {`(a) NFT Entries. Each prospective entrant wishing to enter the Promotion through the acquisition of a Ticket to ZeroG NFT (“Promotion NFT”) must: (i) already have or, if not, obtain, a wallet application (“Wallet”) that is capable of holding the tokens associated with the Promotion which will be launched and stored on the Ethereum blockchain; (ii) hold the vMooney token; and (iii) visit the Sponsor website located at https://app.moondao.com (the “Site”) and mint a Promotion NFT during the Promotion Period. In order to mint a Promotion NFT, you must pay the Gas Fees. For purposes of these Rules, the “Gas Fees” shall mean the amount of ETH charged by Ethereum. Gas Fees are determined by the then-current demand on the Ethereum blockchain, at the time of a given transaction. In order to complete the registration process and obtain a Promotion NFT, each prospective entrant must: (A) provide her/his Twitter® handle and follow Sponsor’s Twitter® account (a prospective entrant may need to create a new Twitter® account where she/he does not already have one); (B) provide her/his Discord® username (a prospective entrant may need to create a new Discord® account where she/he does not already have one); (C) provide an Ethereum wallet address with on-chain proof of staking Mooney for vMooney; and (D) provide an associated email address. Each individual whose Wallet indicates ownership of Promotion NFT on 11:59:00 p.m. PST on April 30, 2023 (“Snapshot Date”) shall receive one (1) entry in the Promotion, up to a maximum of one (1) Raffle Entry.**`}{' '}
          </p>
          <p className="italic">{`
           Discord® is a registered trademark of Discord Inc. (“Discord”). Twitter® is a registered trademark of Twitter, Inc. (“Twitter”). Please be advised that Sponsor is not in any way affiliated with Discord and/or Twitter, and the Promotion is not endorsed, administered or sponsored by Discord and/or Twitter.
            `}</p>

          <p
            className="rounded-md p-2"
            ref={altEntryRef}
          >{`(b) Alternative Means of Entry.** As an alternative means of entry in the Promotion, each prospective entrant may submit a mail-in entry in the form of a handwritten self-addressed, stamped envelope that contains the AMOE Registration Data, as defined below (each, an “AMOE Entry Submission”). For a properly submitted AMOE Entry Submission, the entrant shall receive one (1) one entry in the Promotion (each, an “AMOE Entry,” and together with the NFT Entries, the “Entries”), up to a maximum of one (1) AMOE Entry. To complete an AMOE Entry Submission, each entrant must legibly handwrite (no typing allowed) on a piece of paper included in the AMOE Entry Submission her/his: (i) full name; (ii) mailing address; (iii) telephone number; and (iv) Ethereum wallet address (collectively, “AMOE Registration Data”) and mail to Attn: Pablo Moncada-Larrotiz PO Box 460446 San Francisco, CA, 94146. All AMOE Entry Submissions must be postmarked no earlier than March 29, 2023 and no later than April 23, 2023 to be eligible to receive an AMOE Entry. Any improperly submitted AMOE Entry Submissions (i.e., any potential AMOE Entry Submissions having invalid or incomplete AMOE Registration Data) will be VOID`}</p>
          <p>{`(c) Entry Limits/General Provisions. Each entrant’s Wallet must be maintained in good standing throughout the Promotion Period to remain eligible to receive a Prize. Entrants may not own more than one (1) Promotion NFT on the Snapshot Date. Any prospective entrant that owns more than one (1) Promotion NFT on the Snapshot Date will be automatically disqualified from participation in the Promotion. The total combined number of Entries obtained during the Promotion Period per entrant may not exceed one (1) in the aggregate. So, by way of example, if an entrant submits an AMOE Entry during the Promotion Period, that entrant will not be permitted to also obtain a Promotion NFT Entry during the Promotion Period. Multiple individuals are not permitted to share the same Wallet. Any attempt by any individual to obtain more than the permitted number of Entries by using multiple/different Wallets, e-mail addresses, identities, or any other method, will void all of that individual’s Entries and that individual will be disqualified from participating in the Promotion. Use of any automated system to participate in the Promotion is prohibited and will result in disqualification. Sponsor reserves the right to reject any Entry that it believes, in its sole and reasonable discretion, is fraudulent, incomplete or otherwise invalid. Sponsor is not responsible for Entries, notifications, claims or notices that are lost, late, illegible, misdirected, damaged, incomplete or incorrect. Entrants who are potential Prize winners may be required to provide some or all of the following: (i) Social Security Number; (ii) Photo ID; and (iii) any other information requested by Sponsor in connection with the Prize verification/award process (“Prize Winner Data” and together with the Site Registration Data and AMOE Registration Data, the “Registration Data”). SPONSOR IS NOT RESPONSIBLE FOR ENTRIES, PROMOTION NFTS, TOKENS, WALLETS, CLAIMS OR NOTICES THAT ARE LOST, LATE, ILLEGIBLE, MISDIRECTED, DAMAGED, INCOMPLETE OR INCORRECT. IF YOU FAIL TO OBTAIN AN ENTRY FOR ANY REASON WHATSOEVER, YOU WILL NOT QUALIFY FOR A PRIZE.`}</p>

          <p>{`(d) Cheating, Fraud and Abuse. By participating in the Promotion as an entrant, you represent and warrant to us that you will not engage in any activity that interrupts or attempts to interrupt the operation of the Promotion. Anyone who engages in, participates in, or displays behavior that may be interpreted, in Sponsor’s sole discretion, as unfair methods of participating in the Promotion as an entrant including, but not limited to, the use of multiple Wallets, the use of unauthorized or altered software or hardware to assist entry (e.g., scripts, bots, bot nets, and collusion with bots), intentionally giving other entrants a competitive advantage, Collusion (as defined below) with any other entrant(s), harassment of other entrant(s), breach of these Rules, or any other act (whether through the use of automated technology or otherwise) that unfairly alters an entrant’s chance of winning or constitutes the commission of fraud (collectively, “Abuse”), will be subject to immediate sanctions (as determined by Sponsor in Sponsor’s sole discretion), which may include, without limitation: (i) immediate MoonDAO membership termination and blocking of access to the MoonDAO community; (ii) any Prize that the applicable entrant may otherwise have been entitled to receive shall be void and forfeited; and (iii) any Prize received by the applicable entrant shall be subject to disgorgement and/or recoupment. In addition to the foregoing, Sponsor reserves the right to disclose or report any illegal activity to law enforcement and regulatory authorities. Without limiting Sponsor’s other available remedies, Sponsor may institute or seek any injunctive relief, civil and/or criminal proceedings against any entrant and/or any co-conspirators arising out of or related to the commission of Abuse including, without limitation, recovering all of Sponsor’s fees and expenses (including reasonable attorneys’ fees) in connection with such efforts. For purposes of these Rules, “Collusion” shall mean where two (2) or more entrants or MoonDAO members collaborate or adopt a strategy (before, during or after the Promotion Period) in order to mutually gain an advantage, give an advantage to one (1) entrant, and/or harm other entrants.**`}</p>

          <hr></hr>
          <RuleTitle title={'IDENTIFICATION OF ENTRANTS'} />

          <p>
            {`Each Entry will be identified by the applicable Wallet address as collected and stored in the Promotion Database and cross referenced with an associated email address, Twitter and Discord accounts. For purposes of these Rules, the “Promotion Database” is defined as the entire list of valid Entries recorded on the Snapshot Date. Sponsor will stop accepting Entries on the Promotion End Date.`}
          </p>
          <hr></hr>
          <RuleTitle title={'HOW TO WIN A PRIZE'} />

          <p>
            {`(a) How to Win a Prize. Within twenty-four (24) hours of the Snapshot Date, Sponsor will randomly select ten (10) Entries from the Promotion Database, selected in order from one (1) to ten (10), as potential Prize winners (collectively, “Prize Winner Selection”). The first potential Prize winner selected will be the potential Grand Prize (as defined below) winner. Entrants may not own more than one (1) Promotion NFT on the Snapshot Date. Any prospective entrant that owns more than one (1) Promotion NFT on the Snapshot Date will be automatically disqualified from participation in the Promotion. The potential Prize winners will be notified by the publication, on the Snapshot Date, of their respective Wallet addresses on Sponsor’s Discord® channel. The potential Prize winners shall be subject to eligibility verification. The potential Prize winners will be required to provide Prize Winner Data and may be required to execute a notarized Affidavit of Eligibility and Liability/Publicity Release (“Affidavit”) and, where so required, return such Affidavit within seven (7) days following the Snapshot Date. The Grand Prize winner must provide documentation demonstrating that they can legally travel to the United States ("US Visa") that is satisfactory to Sponsor in its sole and reasonable discretion by 11:59:00 p.m. PST on May 19, 2023 (“Cutoff Date”) before an alternative Prize winner is selected. In addition, potential Prize winners may be required to provide Photo ID, and proof that they are the entrants that obtained the applicable potential winning Entries. Potential Prize winners may also be required to submit to confidential background checks to confirm eligibility and ensure that the use of any such person in advertising, promotion or publicity, will not pose a security threat or bring Covered Parties (as defined below) into public disrepute, contempt, scandal or ridicule or reflect unfavorably on Covered Parties as determined by Sponsor in its sole discretion, and, in the event of such an eventuality, the applicable Prize may be forfeited.`}
          </p>
          <p>
            {`Non-compliance by a potential Prize winner within the aforementioned time period may result in forfeiture of the subject Prize, with an alternative Prize winner selected. The return of a Prize and/or Prize notification as undeliverable may result in forfeiture of the subject Prize. In no case shall Sponsor be liable in any manner where a potential Prize winner has not received notification provided by Sponsor or where Sponsor fails to receive a response from a potential Prize winner within the required response period.`}
          </p>
          <p>
            {`Each potential winning Prize Entry, as well as the associated information of the applicable potential Prize winner, must identically match the records maintained by Sponsor in order for a Prize to be awarded. In the event of a dispute, the information maintained by Sponsor will govern. Entries will be deemed made by the person who owns the subject Wallet associated with each Entry.`}
          </p>
          <p>
            {`Where the Grand Prize winner forfeits the Grand Prize and/or is disqualified for any reason, the second Prize winner selected during the Prize Winner Selection process shall be deemed the potential Grand Prize winner. If the second Prize winner selected during the Prize Winner Selection process forfeits the Grand Prize and/or is disqualified for any reason, the third Prize winner selected during the Prize Winner Selection process shall be deemed the potential Grand Prize winner, and so on and so forth.`}
          </p>
          <hr></hr>
          <RuleTitle title={'PRIZE DESCRIPTION'} />

          <p>
            {`a) Grand Prize. The Grand Prize winner shall receive: the opportunity to participate on an upcoming flight on the Zero Gravity Corporation’s flight chartered by Sponsor (each, a “Flight”) on June 9th, 2023 in Houston, Texas, which intends to travel in such a way as to experience the sensation of weightlessness. The Grand Prize includes the Flight and any events associated with the public ticketed event, but does not include travel expenses or lodging.`}
          </p>
          <p>{`(b) Grand Prize Terms and Conditions. The specifics of all aforementioned elements of the Grand Prize shall be determined in the sole and exclusive discretion of ZeroG and Sponsor. Some restrictions apply. As a condition precedent to accepting the Grand Prize, the potential Grand Prize winner must enter into a separate contract with ZeroG, including the Informed Consent document referenced therein, as well as any and all publicity waivers, health and safety waivers, waivers of claims, Non-Disclosure Agreements (“NDA”), codes of conduct and/or any other agreements, documents and/or policies required by ZeroG from time-to-time, in its sole and absolute discretion (collectively, “ZeroG Agreements”). The potential Grand Prize winner must also comply with any and all personal codes of conduct established by ZeroG, from time-to-time. The potential Grand Prize winner acknowledges and agrees that ZeroG reserves the right at any time, and in its sole discretion, to remove the potential Grand Prize winner from her/his assigned Flight for any or no reason whatsoever including, without limitation, for weight and balance constraints and/or for violation of any ZeroG Agreement(s) and/or codes of conduct. The potential Grand Prize winner should discuss any aspects of her/his participation in the Flight with appropriate medical, legal, emergency contact, and insurance professionals as she/he deems necessary. The potential Grand Prize winner must promptly notify ZeroG of any situation that may impair or affect the potential Grand Prize winner’s ability to participate in the applicable Flight. Without limiting the foregoing, in the event the potential Grand Prize winner tests positive for COVID-19 within fourteen (14) days of the targeted Flight date, or experiences another medical condition that would prevent the potential Grand Prize winner’s participation in the Flight, the potential Grand Prize winner understands and agrees that she/he may forfeit the Grand Prize in its entirety. ZeroG may provide the potential Grand Prize winner with familiarization and training as determined by ZeroG, in its sole discretion, to be necessary for the potential Grand Prize winner to participate in the Flight. Such familiarization and training will occur in Houston, Texas, prior to departure or in some other location that ZeroG deems appropriate. ZeroG, in its sole discretion, shall determine whether the potential Grand Prize winner has sufficiently completed all Flight-related familiarization and training in advance of the Flight. The potential Grand Prize winner shall participate in pre- and/or post-Flight media or publicity activities as reasonably requested by ZeroG and/or Sponsor. The potential Grand Prize winner understands and acknowledges that as part of the Flight, the potential Grand Prize winner may be required by ZeroG to visibly wear items or otherwise use items from ZeroG’s sponsorship partners and participate in media events related to the Flight with ZeroG’s sponsorship partners. The potential Grand Prize winner is prohibited from monetizing her/his participation in the Flight without ZeroG’s prior written consent, in each instance. Without limiting the foregoing, the potential Grand Prize winner is prohibited from advertising, promoting, wearing, displaying, or otherwise supporting the brand, logo, trademark, or recognizable marking of any other entity, corporation, person, or organization in Flight-related or ZeroG-related activities or events without the express advance written permission of ZeroG.`}</p>
          <p>{`ZeroG and Sponsor will determine flight dates for each applicable Flight in their respective sole and exclusive discretion and such flight dates may be postponed at any time by ZeroG in its sole discretion. The potential Grand Prize winner shall arrive in the vicinity of Houston at least one (1) day in advance of the Flight launch date (“Launch Date”) and at the location specified by ZeroG. The potential Grand Prize winner may participate in post-Flight debrief activities with ZeroG or Sponsor, at ZeroG’s or its affiliates’ facilities in Texas, which debriefs may include, at ZeroG’s discretion: (i) recording of data or experiences associated with the Flight; (ii) written and/or digital surveys; and/or (iii) in-person (or over the phone) interviews.`}</p>
          <p>{`The Grand Prize winner is responsible to cover the actual, out of pocket costs incurred by the Grand Prize winner for all travel costs associated with travel to Houston, Texas, and transportation to and from the departure airport and arrival airport if necessary (collectively, “Travel Costs”), for the Grand Prize winner (as defined below); and is also responsible for the actual municipal, state and federal income taxes incurred by the Grand Prize winner (“Grand Prize Taxes”) that are directly attributable to the Grand Prize (collectively, the “Grand Prize,” and together with the Alternate Prizes, the “Prizes”). The ARV of the Grand Prize is Fifteen Thousand Dollars (US$15,000.00). The Grand Prize winner will not receive the difference between the actual Prize value and the ARV. Any guests in addition to the potential Grand Prize winner are responsible for arranging, and paying, for transportation to Houston, Texas. The potential Grand Prize winner is responsible for any food and beverages during their stay that are not included in the ticketed event program.`}</p>
          <p>{`Other than as expressly set forth above, the potential Grand Prize winner and her/his Guest are solely responsible for arranging, and paying, for transportation to and from the Flight Site, the post-Flight debrief site and/or any pre-Flight training site designated by ZeroG, as well as for any hotel accommodations required in connection with same that are not expressly set forth above.
`}</p>
          <p>{`No refund or compensation will be made in the event of the cancellation or delay of any Flight. The potential Grand Prize winner (and Guest, where applicable) is solely responsible for obtaining any identification documents necessary for travel to the United States. The potential Grand Prize winner is responsible for obtaining travel insurance (and all other forms of insurance) at her/his option and the potential Grand Prize winner hereby acknowledges that neither Sponsor nor ZeroG will obtain nor provide travel insurance or any other form of insurance. The Grand Prize is, at all times, subject to all applicable federal, state and local laws and regulations.
`}</p>
          <p>{`Travel, lodging, incidentals, tips, telephone calls and any other personal expenses incurred in connection with the Grand Prize are the responsibility of the potential Grand Prize winner. No part of the Grand Prize is transferable or may be converted to a cash payment, resold, included in a separate promotion, or otherwise distributed to any member of the general public.`}</p>
          <hr></hr>
          <RuleTitle title={'ODDS OF WINNING A PRIZE'} />

          <p>
            {`Grand Prize Odds. The odds of winning the Grand Prize depend on the number of Entries received during the Promotion Period, but can be calculated by dividing the number of Grand Prizes (1) by the total number of Entries received.`}
          </p>
          <p>
            For a thorough recital of the Sponsor Privacy Policy,
            <span className="text-n3blue">
              <Link href="https://docs.moondao.com/privacy-policy/">
                {'\n Click Here'}
              </Link>{' '}
            </span>
            To the extent that the Sponsor Privacy Policy is in conflict or
            inconsistent with these Rules as they pertain to the Promotion,
            these Rules shall take precedence.
          </p>
          <hr></hr>
          <RuleTitle title={'TAX INFORMATION'} />

          <p>{`All federal, state and local taxes, and all similar fees and assessments, are the responsibility of the Prize winners. Sponsor reserves the right to withhold taxes from a winning Prize, as appropriate. Where required by law, Sponsor will issue a form 1099-MISC for the Prize winner(s) in the amount of the applicable Prize(s).`}</p>
          <hr></hr>
          <RuleTitle title={'NO SUBSTITUTION OF WINNERS'} />

          <p>{`The Promotion NFTs are not transferable before Snapshot Date, and may not be sold, under any circumstances. The Prizes are non-transferable, and no substitution or transfer of a Prize will be accommodated or permitted, other than as expressly set forth herein or in Sponsor’s sole discretion. Sponsor reserves the right to substitute a Prize, or any portion thereof, for a substitute of equal or greater value for any reason.`}</p>
          <hr></hr>
          <RuleTitle title={'PUBLICITY'} />

          <p>{`Other than for residents of the State of Tennessee and where otherwise prohibited by law, Promotion entry constitutes permission for Sponsor and ZeroG ‌to‌ ‌reproduce,‌ ‌display,‌ ‌perform,‌ ‌distribute‌ ‌and‌ ‌otherwise‌ ‌use‌ each entrant’s name and/or likeness ‌in‌ ‌connection‌ ‌with‌ promoting Sponsor, ZeroG and/or their respective products, services and offerings in any and all forms of marketing and promotional material including, without limitation, email marketing, online ads, social media ads/announcements, as well as printed extracts and reproductions of any portion thereof.`}</p>
          <hr></hr>
          <RuleTitle title={'RELEASE'} />

          <p>{`By entering the Promotion, each entrant agrees to release and hold harmless Sponsor, ZeroG, and each of their respective representatives, affiliates, subsidiaries, parents, agents, and their respective members, officers, directors, employees and agents (collectively, “Covered Parties”) from and against any and all liability for any injuries, loss or damage of any kind arising from, or in connection with, the Promotion (including the Prizes) including, but not limited to: (a) any physical, emotional or psychological injury including, but not limited to, illness, paralysis, death, damages, economic loss or emotional loss arising out or relating to, participation in the Flight (including any training and familiarization activities associated therewith); and/or (b) liability arising from copyright infringement, improper use of likeness, personal injury, death, damages or monetary loss. Restrictions, conditions and limitations apply. By entering, each entrant further agrees that, in the event that there is any conflict or other inconsistency between the Rules and any advertisements, promotional or marketing materials, e-mails or announcements relevant to the Promotion, these Rules will govern. Without limiting the foregoing, The Covered Parties are not responsible for the actions of entrants in connection with the Promotion, including entrants’ attempts to circumvent these Rules or otherwise interfere with the administration, security, fairness, integrity or proper conduct of the Promotion.`}</p>
          <hr></hr>
          <RuleTitle title={'CHOICE OF LAW/DISPUTE RESOLUTION/CLASS ACTION'} />

          <p>{`These Rules shall be treated as though they were executed and performed in the State of New York and shall be governed by and construed in accordance with the laws of the State of New York (without regard to conflict of law principles). The parties hereby agree to arbitrate all claims that may arise under and/or relate to the Promotion and/or these Rules. Without limiting the foregoing, should a dispute arise between the parties including, without limitation, any matter concerning the Promotion, the Prizes (including the Flight), the terms and conditions of these Rules or the breach of same by any party hereto: (a) the parties agree to submit their dispute for resolution by arbitration before the American Arbitration Association (“AAA”) in New York, NY, in accordance with the then current Commercial Arbitration rules of the AAA; and (b) you agree to first commence a formal dispute proceeding by completing and submitting an Initial Dispute Notice which can be found here. The Covered Party(ies) named in your Initial Dispute Notice (collectively, the “Named Parties”) may choose to provide you with a final written settlement offer after receiving your Initial Dispute Notice (“Final Settlement Offer”). If the applicable Named Party(ies) provide(s) you with a Final Settlement Offer and you do not accept it, or such Named Party(ies) cannot otherwise satisfactorily resolve your dispute and you wish to proceed, you must submit your dispute for resolution by arbitration before the AAA, in your county of residence, by filing a separate Demand for Arbitration, which is available here. For claims of Ten Thousand Dollars ($10,000.00) or less, you can choose whether the arbitration proceeds in person, by telephone or based only on submissions. If the arbitrator awards you relief that is greater than the applicable Final Settlement Offer, then the Named Party(ies) will pay all filing, administration and arbitrator fees associated with the arbitration and, if you retained an attorney to represent you in connection with the arbitration, the Named Party(ies) will reimburse any reasonable attorneys' fees that your attorney accrued for investigating, preparing and pursuing the claim in arbitration. Any award rendered shall be final and conclusive to the parties and a judgment thereon may be entered in any court of competent jurisdiction. Although the Named Party(ies) may have a right to an award of attorneys' fees and expenses if Named Party(ies) prevail(s) in arbitration, the Named Party(ies) will not seek such an award from you unless the arbitrator determines that your claim was frivolous.
`}</p>
          <p>{`To the extent permitted by law, you agree that you will not bring, join or participate in any class action lawsuit as to any claim, dispute or controversy that you may have against any of the Covered Parties. You agree to the entry of injunctive relief to stop such a lawsuit or to remove you as a participant in the suit. You agree to pay the attorney's fees and court costs that any Covered Party incurs in seeking such relief. This provision prevents you from bringing, joining or participating in class action lawsuits: (i) does not constitute a waiver of any of your rights or remedies to pursue a claim individually and not as a class action in binding arbitration as provided above; and (ii) is an independent agreement. You may opt-out of these dispute resolution provisions by providing written notice of your decision within thirty (30) days of the date that you first enter the Promotion.`}</p>
          <hr></hr>
          <RuleTitle title={'DISQUALIFICATION'} />

          <p>{`The Covered Parties are not responsible for lost, interrupted or unavailable network server or other connections, miscommunications, failed telephone or computer transmissions or technical failure, lost Entries, staking errors, technical issues or other errors, jumbled, scrambled or misdirected transmissions, lost AMOE Entries, errors related to any entrant’s Wallet, associated blockchain technology, or other error of any kind, whether human, mechanical or electronic. Persons found tampering with or abusing any aspect of the Promotion, as solely determined by Sponsor, will be disqualified. If disqualified for any of the above reasons, Sponsor reserves the right to terminate entrant’s eligibility to participate in the Promotion. In the event that any portion of the Promotion is compromised by technical error, virus, bugs, non-authorized human intervention or other causes beyond the control of Sponsor which, in the sole opinion of Sponsor, corrupts or impairs the administration, security, fairness or proper determination of the Promotion, Sponsor reserves the right, in its sole discretion, to suspend or terminate the Promotion or any part of the Promotion, or any combination of the above. The Covered Parties are not responsible for any problem with Entries generated by computer hardware or software malfunction, error or failure, whatever the cause.`}</p>
          <hr></hr>
          <RuleTitle title={'FORCE MAJEURE EVENTS'} />

          <p>{`The Covered Parties are not responsible or liable to any entrant or potential Prize winner (or any person claiming through such entrant or potential Prize winner) for failure to supply a Prize or any part thereof, by reason of any acts of God, any action, regulation, order or request by any governmental or quasi-governmental entity (whether or not the action, regulations, order or request proves to be invalid), equipment failure, threatened terrorist acts, terrorist acts, air raid, blackout, act of public enemy, earthquake, volcanic eruption, war (declared or undeclared), fire, flood, COVID-19 or any similar virus, disease and/or pandemic, as well as any private sector or governmental response thereto, explosion, unusually severe weather, hurricane, embargo, labor dispute or strike (whether legal or illegal) labor or material shortage, transportation interruption of any kind, work slow-down, civil disturbance, insurrection, riot, or any other cause beyond the sole control of Sponsor and/or ZeroG including, without limitation, any matter related to the Boeing 727-200 vehicle, Flight-related launch conditions and/or governmental regulations, decisions, actions and/or orders related to voyages similar to the Flight (collectively, “Force Majeure Events”).`}</p>
          <hr></hr>
          <RuleTitle title={'INDEMNIFICATION'} />

          <p>{`You agree to release, indemnify and hold the Covered Parties harmless from and against any and all claims, expenses (including reasonable attorneys' fees, costs and settlement costs), damages, suits, costs, demands and/or judgments whatsoever, made by any third party due to or arising out of: (a) your improper and/or unauthorized participation in the Promotion; (b) your breach of these Rules; and/or (c) your violation of any rights of another individual and/or entity. The provisions of this paragraph are for the benefit of the Covered Parties. Each of these individuals and entities shall have the right to assert and enforce these provisions directly against you on its own behalf.`}</p>
          <hr></hr>
          <RuleTitle title={'LEGAL WARNING'} />

          <p>{`Any attempt by any individual, whether or not an entrant, to damage, destroy, tamper with or vandalize any portion of the Promotion, or otherwise interfere with the operation of the Promotion, is a violation of criminal and civil law and Sponsor will diligently pursue any and all remedies in this regard against any offending individual or entity to the fullest extent permissible by law and in equity.`}</p>
        </div>
        <button
          className="mt-10 flex items-center bg-[grey] text-lg rounded px-2 py-1 text-gray-100 hover:scale-[1.05] hover:text-white hover:bg-n3blue ease-in duration-150"
          onClick={() => router.push('/zero-g')}
        >
          {'← Back'}
        </button>
      </div>
    </div>
  )
}

export const getStaticProps: GetStaticProps = async (context) => {
  return {
    props: {
      slug: context.params?.slug,
    },
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [
      { params: { slug: ['rules'] } },
      { params: { slug: ['rules', 'alt-entry'] } },
    ],
    fallback: false,
  }
}
