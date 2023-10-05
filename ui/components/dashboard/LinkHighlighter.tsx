interface TextHighlighter{
  text:string
  label:string
}


export default function TextHighlighter({ text, label }:TextHighlighter) {
  // Define the regex pattern to match https:// links
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  // Split the text into an array of segments separated by the regex pattern
  const segments = text.split(urlRegex);
  // Map over the segments and highlight any that match the regex pattern
  const highlightedSegments = segments.map((segment, index) => {
    if (segment.match(urlRegex)) {
      // If the segment is a URL, wrap it in an anchor tag
      return (
        <a
          key={index}
          href={segment}
          target="_blank"
          rel="noopener noreferrer"
          className="text-moon-blue dark:text-moon-gold"
        >
          {label || segment}
        </a>
      );
    } else {
      // If the segment is not a URL, return it as-is
      return segment;
    }
  });

  // Return the highlighted text as a single string
  return <>{highlightedSegments}</>;
}
