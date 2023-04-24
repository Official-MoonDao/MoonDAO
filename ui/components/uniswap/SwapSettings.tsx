export default function SwapSettings({
  slippageAmt,
  setSlippageAmt,
  deadlineMinutes,
  setDeadlineMinutes,
}: any) {
  return (
    <div className="w-full">
      <div>
        <h4>Transaction Settings</h4>

        <div>
          <label>Slippage Tolerance</label>
        </div>
        <div className="flex w-full items-center gap-[5%]">
          <div className="flex flex-col gap-1 my-2 w-1/3">
            <input
              className="text-black pl-2 rounded-md"
              placeholder="1"
              type={'number'}
              value={slippageAmt}
              onChange={(e) => {
                setSlippageAmt(e.target.value)
              }}
              step={1}
            />
          </div>
          <div>
            <span>%</span>
          </div>
          <p className="opacity-[0.5] text-[50%]">{`rounded to the nearest whole number`}</p>
        </div>

        <div>
          <label>Transaction Deadline</label>
        </div>
        <div className="flex w-full items-center">
          <div className="flex w-1/3">
            <input
              className="w-1/2 text-black pl-2 rounded-md"
              placeholder="10"
              value={deadlineMinutes}
              onChange={(e) => setDeadlineMinutes(e.target.value)}
              type={'number'}
              step={1}
            />
          </div>
          <div>
            <span>minutes</span>
          </div>
        </div>
      </div>
    </div>
  )
}
