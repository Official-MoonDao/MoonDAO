import Transaction from './Transaction'

const TransactionSkeletons = () => {
  const data = {
    timeStamp: '1665437003',
    value: '0000000010000000000000000',
    tokenSymbol: 'MOONEY',
    tokenDecimal: '18',
  }

  return (
    <>
      {Array(10)
        .fill(data)
        .map((e, i) => (
          <Transaction key={i} data={e} loading />
        ))}
    </>
  )
}

export default TransactionSkeletons
