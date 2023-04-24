import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { TOKENS } from '../../lib/uniswap-config'
import LoadingSpinner from './LoadingSpinner'

export default function CurrencyField({
  loading,
  value,
  field,
  currentToken,
  setCurrentTokenId,
  balance,
  getSwapPrice,
}: any) {
  const [dropdown, setDropdown] = useState<boolean>(false)

  function getPrice(value: any) {
    getSwapPrice(value)
  }
  const inputRef: any = useRef()

  const filteredTokens = TOKENS.filter(
    ({ name }) => name !== currentToken.name && name !== 'MOONEY'
  )

  useEffect(() => {
    if (field === 'input' && inputRef.current?.value > 0) {
      getPrice(inputRef.current?.value)
    }
  }, [currentToken])

  return (
    <div className="flex gap-[2%] bg-[lightgrey] w-full py-2 px-4 items-center rounded-sm text-black">
      <div className="w-1/2">
        {loading ? (
          <div>
            <LoadingSpinner />
          </div>
        ) : (
          <input
            ref={inputRef}
            className="text-black px-2 w-full"
            placeholder="0.000"
            value={value}
            readOnly={field === 'output'}
            onBlur={(e) =>
              field === 'input' && +e.target.value > 0
                ? getPrice(e.target.value)
                : null
            }
          />
        )}
      </div>
      <div className="flex w-full items-center">
        <div
          className="flex flex-col"
          onMouseEnter={() => field === 'input' && setDropdown(true)}
          onMouseLeave={() => field === 'input' && setDropdown(false)}
        >
          <div className="flex items-center gap-1">
            <Image
              src={currentToken.icon}
              width={currentToken.name === 'MOONEY' ? 70 : 50}
              height={currentToken.name === 'MOONEY' ? 70 : 50}
              alt=""
            />
            <h3>{currentToken.name}</h3>
          </div>
          {field === 'input' && dropdown && (
            <div className="absolute p-2 rounded-sm bg-white w-[40%] z-20 h-[75%] overflow-y-scroll">
              <div className="flex items-center gap-1 w-full my-2">
                <Image src={currentToken.icon} width={50} height={50} alt="" />
                <h3 className="w-1/2 text-[75%]">{currentToken.name}</h3>
              </div>
              {filteredTokens.map((t, i) => (
                <div
                  key={'token-' + i}
                  className="flex items-center gap-1 w-full my-2"
                  onClick={() => {
                    setCurrentTokenId(t.id)
                    setDropdown(false)
                  }}
                >
                  <Image src={t.icon} width={50} height={50} alt="" />
                  <h3 className="w-1/2 text-[75%]">{t.name}</h3>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pl-2 w-full text-[75%]">
          <span> Balance: </span>
          <span className="py-1 px-2 bg-[grey] rounded-sm ">
            <span className="text-n3blue">{Number(balance).toFixed(2)}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
