import HighlightStar from "../assets/HighlightStar";

interface Header {
  text: string
  position?: string
  noStar?:boolean
}

const Header = ({ text, position, noStar }: Header) => {
  return (
    <div className="flex items-center">
      {noStar ? "" : <HighlightStar />}
      <h3
        className={`${
          noStar ? "" : "lg:ml-2"
        } bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text font-GoodTimes text-2xl tracking-wide text-transparent dark:from-detail-dark dark:to-moon-gold sm:text-3xl lg:text-4xl ${position}`}
      >
        {text}
      </h3>
    </div>
  );
};

export default Header;
