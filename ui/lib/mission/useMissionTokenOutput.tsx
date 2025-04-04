import { useMemo } from 'react'

export default function useMissionTokenOutput(
  input: number | undefined,
  fundingGoal: number | undefined
) {
  const goalFormatted = fundingGoal ? fundingGoal / 1e18 : 0
  const minGoal = goalFormatted ? goalFormatted * 0.2 : 0

  return useMemo(() => {
    if (!input || input <= 0) {
      return 0
    }

    console.log(input, goalFormatted)

    const output = input * 1e18

    return output
  }, [input])
}
