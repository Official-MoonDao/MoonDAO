import Image from 'next/image'

function PaymentMethod({ icon, label }: { icon?: string; label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 h-[40px] w-[80px] md:h-[50px] md:w-[100px] xl:h-[30px] xl:w-[60px] rounded-lg p-1">
      {label ? (
        <p className=" text-black">{label}</p>
      ) : icon ? (
        <Image src={icon} alt={''} width={100} height={100} />
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
    icon: '/assets/pay-method-debit.svg',
  },
  {
    icon: '/assets/pay-method-apple-pay.svg',
  },
  {
    icon: '/assets/pay-method-google-pay.svg',
  },
  {
    icon: '/assets/pay-method-paypal.svg',
  },
  {
    icon: '/assets/pay-method-venmo.svg',
  },
]

export default function AcceptedPaymentMethods() {
  return (
    <div>
      <div className="p-1 h-full rounded-2xl flex items-center justify-center xl:justify-between flex-wrap gap-1">
        {PAYMENT_METHODS.map((method: any, i) => (
          <PaymentMethod key={'payment-method' + i} {...method} />
        ))}
      </div>
    </div>
  )
}
