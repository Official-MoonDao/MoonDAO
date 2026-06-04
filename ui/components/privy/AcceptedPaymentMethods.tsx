import Image from 'next/image'

function PaymentMethod({
  icon,
  label,
  scale,
  className,
}: {
  icon?: string
  label?: string
  scale?: number
  className?: string
}) {
  return (
    <div
      className={`flex items-center justify-center gap-2 h-[45px] w-[90px] rounded-lg p-1 ${className}`}
      style={{ transform: scale ? `scale(${scale})` : undefined }}
    >
      {label ? (
        <p className=" text-black">{label}</p>
      ) : icon ? (
        <div
          className={`relative w-full h-full flex items-center justify-center`}
        >
          <Image src={icon} alt={''} width={100} height={100} />
        </div>
      ) : null}
    </div>
  )
}

/*
MoonPay Onramp:
- Debit & Credit cards
- Apple Pay / Google Pay
- Bank transfers
*/

const PAYMENT_METHODS = [
  {
    icon: '/assets/pay-method-debit.svg',
    scale: 0.75,
  },
]

export default function AcceptedPaymentMethods() {
  return (
    <div>
      <div className="p-1 h-full rounded-2xl flex items-center justify-center flex-wrap gap-1">
        {PAYMENT_METHODS.map((method: any, i) => (
          <PaymentMethod key={'payment-method' + i} {...method} />
        ))}
        <PaymentMethod label="MoonPay" className="bg-indigo-600/20 border border-indigo-500/30 text-indigo-200" />
      </div>
    </div>
  )
}
