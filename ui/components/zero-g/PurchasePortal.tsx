import ReservationRaffleLayout from './ReservationRaffleLayout'

export default function PurchasePortal() {
  return (
    <ReservationRaffleLayout title="Purchase">
      <button
        onClick={() =>
          window.open('https://www.gozerog.com/reservations/moondao-flight/')
        }
        className="border-style mt-4 tracking-wide btn text-n3blue normal-case font-medium font-GoodTimes w-full  bg-transparent hover:bg-n3blue hover:text-white duration-[0.6s] ease-in-ease-out text-1xl"
      >
        buy a ticket
      </button>
    </ReservationRaffleLayout>
  )
}
