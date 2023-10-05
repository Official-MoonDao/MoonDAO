interface ArticleTitle {
  text: string
  loading?: boolean
  link: string
}

const ArticleTitle = ({ text, loading, link }: ArticleTitle) => {
  return (
    <h3
      className={`font-Montserrat text-[22px] font-bold leading-10 tracking-wide text-title-light  dark:text-title-dark lg:text-2xl ${
        loading
          ? 'loading-line'
          : link &&
            'underline decoration-detail-light decoration-1 duration-200 hover:scale-[1.01] hover:decoration-2 dark:decoration-detail-dark'
      }`}
    >
      {!loading && link ? (
        <a target="_blank" href={link} rel="noreferrer">
          {text}
        </a>
      ) : (
        <>{text}</>
      )}
    </h3>
  )
}

export default ArticleTitle
