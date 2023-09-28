//In the hero its 60 x 60
// If size isn't passed, defaults to the size of how the star looks on section headers.

interface Star {
  size?: {
    width: number;
    height: number;
  };
}
const VerticalStar = ({ size }: Star) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={`${!size ? "40" : size.width}`} height={`${!size ? "41" : size.height}`} fill="none" viewBox="0 0 40 41">
    <path
      fill="#fff"
      d="M19.974.5h.15c0 5.221.503 10.142 1.405 13.85v.05a6.218 6.218 0 0 0 4.57 4.57h.05c3.716.954 8.636 1.49 13.851 1.44v.215c-5.222 0-10.143.503-13.85 1.407h-.052A6.295 6.295 0 0 0 21.53 26.6v.051c-.955 3.716-1.455 8.635-1.406 13.85h-.25c0-5.22-.503-10.14-1.407-13.85v-.049a6.377 6.377 0 0 0-4.564-4.562h-.051C10.135 21.083 5.216 20.582 0 20.633v-.217c5.222 0 10.141-.538 13.85-1.44h.052a6.21 6.21 0 0 0 4.567-4.569v-.05c.955-3.715 1.457-8.636 1.408-13.857h.097Z"
    />
  </svg>
);
export default VerticalStar;
