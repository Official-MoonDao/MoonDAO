import Header from '../../../components/layout/Header'
import Line from '../../../components/layout/Line'
import CaretButton from './CaretButton'
import PaginationButton from './PaginationButton'
import Proposal from './Proposal'

type ProposalListProps = {
  data: any
  skip: number
  setSkip: Function
  isLoading: boolean
}

export default function ProposalList({
  data,
  skip,
  setSkip,
  isLoading,
}: ProposalListProps) {
  const pages = [...Array(6)]
console.log(data)
  return (
    <>
      <div className="flex flex-row justify-between items-center lg:max-w-[1080px]">
        <Header text={'Proposals'} />
      </div>

      <Line />
      <div className="my-3 lg:hidden">
        <p className="text-lg font-semibold text-emerald-900 dark:text-gray-100">
          Click the proposal's title to read more.
        </p>
      </div>
      {!isLoading &&
        data.map((e: any, i: number) => (
          <Proposal
            key={e.id}
            idx={i}
            proposalId={e.id}
            title={e.title}
            author={e.author}
            state={e.state}
            startTime={e.start}
            endTime={e.end}
            body={e.body}
          />
        ))}
{/*Pagination not working properly, jumps to wrong numbers, problem with skip*/}
      <div className="mt-10 flex justify-between max-w-[650px] items-center">
        <CaretButton
          left={true}
          skip={skip}
          setSkip={setSkip}
          total={(pages.length - 1) * 10}
          scrollUp
        />
        {pages.map((e, i) => (
          <PaginationButton
            page={i}
            key={i}
            skip={skip}
            setSkip={setSkip}
            scrollUp
          />
        ))}
        <CaretButton
        left={false}
          skip={skip}
          setSkip={setSkip}
          total={(pages.length - 1) * 10}
          scrollUp
        />
      </div>
    </>
  )
}
