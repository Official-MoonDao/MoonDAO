import Link from "next/link";

const ArrowButton = ({ text, position, link }) => {
  return (
    <Link href={link}>
      <button
        className={`${position} font-mono flex text-gray-100 hover:bg-gradient-to-b from-yellow-600  to-moon-secondary hover:text-white duration-150 items-center gap-2 border-[0.6px] hover:border-yellow-600 rounded border-white border-opacity-50 py-3 pl-6 pr-6 font-bold`}
      >
        {text}{" "}
        <svg
          className="w-6 h-6 transform -scale-x-100"
          viewBox="0 0 24 25"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="stroke-white"
            d="M19 5.5L5 19.5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="stroke-white"
            d="M13 19.5H5V11.5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </Link>
  );
};

export default ArrowButton;
