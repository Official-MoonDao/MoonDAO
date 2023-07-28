const Reaction = ({ reaction, index, loading }) => {
  if (loading) return <div className="loading-line ml-3 h-10 w-12 rounded-full"></div>;

  if(/\P{Extended_Pictographic}/u.test(reaction.emoji.name)) return;
  return (
    <div className={`${index === 0 ? "" : "ml-3"} flex items-center rounded-xl bg-background-light py-1 px-2 dark:bg-background-dark lg:px-3 shadow-sm shadow-detail-light dark:shadow-detail-dark`}>
      <p>{reaction.emoji.name}</p>
      <p className="ml-1 xl:ml-2 text-sm dark:text-dark-text lg:text-base">{reaction.count}</p>
    </div>
  );
};

export default Reaction;
