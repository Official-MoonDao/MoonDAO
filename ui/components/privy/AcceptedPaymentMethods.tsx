import Image from 'next/image'

function PaymentMethod({ icon, label }: { icon?: string; label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 bg-white h-[30px] w-[60px] rounded-lg p-1">
      {label ? (
        <p className=" text-black">{label}</p>
      ) : icon ? (
        <Image src={icon} alt={''} width={50} height={50} />
      ) : null}
    </div>
  )
}
/*
MoonPay Onramp:
- Apple Pay
- PayPal
- Venmo
- Google Pay

Coinbase Onramp:
- Debit
- PayPal
- Apple Pay
- Google Pay
*/

const PAYMENT_METHODS = [
  {
    label: 'Debit',
  },
  {
    icon: '/assets/payment-methods/apple-pay.svg',
  },
  {
    icon: '/assets/payment-methods/google-pay.svg',
  },
  {
    icon: '/assets/payment-methods/paypal.svg',
  },
  {
    icon: '/assets/payment-methods/venmo.svg',
  },
]

export default function AcceptedPaymentMethods() {
  return (
    <div>
      <div className="p-1 h-full rounded-2xl flex items-center justify-between flex-wrap gap-1">
        {PAYMENT_METHODS.map((method: any) => (
          <PaymentMethod key={method?.label || ''} {...method} />
        ))}
      </div>
    </div>
  )
}
