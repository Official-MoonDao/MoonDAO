export default function CardGridContainer({
  children,
  className = '',
  xsCols = 1,
  smCols = 1,
  mdCols = 2,
  maxCols = 3,
  noGap = false,
}: any) {
  const gridStyle = {
    '--xs-cols': xsCols,
    '--sm-cols': smCols,
    '--md-cols': mdCols,
    '--max-cols': maxCols,
  } as React.CSSProperties

  return (
    <div
      id="card-grid-container"
      style={gridStyle}
      className={`h-full w-full mb-10 grid mt-5 ${
        noGap ? '' : 'gap-5'
      } [&>*]:self-start
        [grid-template-columns:repeat(var(--xs-cols),minmax(0,1fr))]
        min-[900px]:[grid-template-columns:repeat(var(--sm-cols),minmax(0,1fr))]
        min-[1200px]:[grid-template-columns:repeat(var(--md-cols),minmax(0,1fr))]
        2xl:[grid-template-columns:repeat(var(--max-cols),minmax(0,1fr))]
        ${className}`}
    >
      {children}
    </div>
  )
}
