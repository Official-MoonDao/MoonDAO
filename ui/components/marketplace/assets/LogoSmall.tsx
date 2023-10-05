// If size isn't passed, defaults to the size of how the logo looks on the mobile navbar.

interface Logo {
  size?: {
    height: number;
    width: number;
  };
}

const LogoSmall = ({ size }: Logo) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={`${!size ? 36.52 : size.width}`}
    height={`${!size ? 38.56 : size.height}`}
    viewBox="0 0 350 365"
    fill="none"
    className=""
  >
    <path
      fill="#00156A"
      d="M332.21 295.813V67.692a267.979 267.979 0 0 0-157.325-51.039A267.98 267.98 0 0 0 17.559 67.692v228.121a268.057 268.057 0 0 0 157.326 51.02 268.054 268.054 0 0 0 157.325-51.02Z"
    />
    <path
      fill="#F7931E"
      d="M107.87 181.547c32.269 0 58.428-26.148 58.428-58.403 0-32.255-26.159-58.403-58.428-58.403S49.443 90.89 49.443 123.144c0 32.255 26.159 58.403 58.427 58.403Z"
    />
    <path
      fill="#8A002D"
      d="M332.21 295.556c-229.5-26.866-143.758-101.974-131.564-109.313-8.626 5.132-183.087 109.364-183.087 109.364l20.537 13.498a260.277 260.277 0 0 0 136.397 38.839 260.276 260.276 0 0 0 136.513-38.429l21.23-13.882-.026-.077Z"
    />
    <path
      fill="#F2F2F2"
      d="M216.023 176.364s15.248-12.086 15.402-20.683c.257-9.52-17.969-37.643-17.969-37.643 12.835 17.423 20.947 24.351 20.947 24.351 11.886 11.086 36.941-5.132 61.842-20.938 0 0-29.47 20.938-42.075 36.643-5.16 6.646.257 18.629 5.109 26.661 0 0-10.5-15.884-20.974-16.449-9.601-.385-22.282 8.058-22.282 8.058Z"
    />
    <path
      fill="#fff"
      d="M174.898 16.654a267.054 267.054 0 0 1 157.312 51.32v228.891a267.213 267.213 0 0 1-157.325 51.221 267.214 267.214 0 0 1-157.326-51.221V67.846a267.055 267.055 0 0 1 157.339-51.32v.128Zm0-10.393A276.044 276.044 0 0 0 11.526 59.558l-4.235 3.079V301.97l4.235 3.079a277.557 277.557 0 0 0 163.372 53.17 277.558 277.558 0 0 0 163.371-53.17l4.21-3.079V62.637l-4.21-3.08A276.095 276.095 0 0 0 174.898 6.39v-.128Z"
    />
    <defs>
      <linearGradient id="a" x1={17.559} x2={332.21} y1={181.752} y2={181.752} gradientUnits="userSpaceOnUse">
        <stop stopColor="#00156A" />
        <stop offset={0.19} stopColor="#032074" />
        <stop offset={0.72} stopColor="#0B3B8E" />
      </linearGradient>
      <linearGradient id="b" x1={49.443} x2={166.298} y1={123.144} y2={123.144} gradientUnits="userSpaceOnUse">
        <stop stopColor="#F7931E" />
        <stop offset={0.47} stopColor="#F8A439" />
        <stop offset={1} stopColor="#F9B95C" />
      </linearGradient>
      <linearGradient id="c" x1={134.774} x2={228.645} y1={365.044} y2={202.4} gradientUnits="userSpaceOnUse">
        <stop stopColor="#8A002D" />
        <stop offset={0.78} stopColor="#D7594F" />
      </linearGradient>
    </defs>
  </svg>
);
export default LogoSmall;
