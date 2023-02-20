import MainCard from '../../components/layout/MainCard'

export default function ZeroGDetail() {
  return (
    <div className="flex flex-col justify-center items-center">
      <h1 className="font-GoodTimes text-3xl mb-8">Zero G Raffle Details</h1>
      <MainCard>
        <p className="font-RobotoMono ">Alt Entry: </p>
        <p className="font-RobotoMono ">Rules: </p>
        <p className="font-RobotoMono ">Disclaimer: </p>
      </MainCard>
    </div>
  )
}
