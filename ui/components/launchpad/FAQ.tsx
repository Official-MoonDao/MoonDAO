import { createContext, useContext, useEffect, useState } from 'react'
import { MinusIcon, PlusIcon } from '@heroicons/react/20/solid'

// Create a context for FAQ items
const FAQContext = createContext<{
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}>({
  expandedId: null,
  setExpandedId: () => {}
});

// Provider component that will wrap all FAQ items
export function FAQProvider({ children, defaultExpandedIndex = 0 }: { 
  children: React.ReactNode;
  defaultExpandedIndex?: number;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Set the default expanded item after first render
  useEffect(() => {
    if (!initialized && defaultExpandedIndex >= 0) {
      // We'll set the expanded ID to "faq-{index}" after the first render
      setExpandedId(`faq-${defaultExpandedIndex}`);
      setInitialized(true);
    }
  }, [defaultExpandedIndex, initialized]);

  return (
    <FAQContext.Provider value={{ expandedId, setExpandedId }}>
      {children}
    </FAQContext.Provider>
  );
}

// Counter to generate unique IDs
let faqCounter = 0;

export default function FAQ({
  question,
  answer,
  isExpanded: externalIsExpanded,
  toggleFAQ: externalToggleFAQ
}: {
  question: string
  answer: string
  isExpanded?: boolean
  toggleFAQ?: () => void
}) {
  // Generate a unique ID for this FAQ item
  const [uniqueId] = useState(() => `faq-${faqCounter++}`);
  
  // Get context
  const context = useContext(FAQContext);
  
  // Determine if this item is expanded
  // Priority: external prop > context > internal state
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  const isExpanded = externalIsExpanded !== undefined ? 
    externalIsExpanded : 
    context.expandedId === uniqueId;
  
  // Toggle function based on available options
  const toggleFAQ = externalToggleFAQ || (() => {
    if (context.expandedId === uniqueId) {
      // If this item is already expanded, collapse it
      context.setExpandedId(null);
    } else {
      // Otherwise expand this item (which collapses others)
      context.setExpandedId(uniqueId);
    }
  });
  
  return (
    <div className="flex flex-col">
      <div className="flex gap-4 mt-[5vw] md:mt-[2vw] items-center">
        <button
          type="button"
          className="flex items-center justify-center gap-2 gradient-2 rounded-full h-9 w-9"
          onClick={toggleFAQ}
        >
          {isExpanded ? (
            <MinusIcon className="w-5 h-5" color="white" />
          ) : (
            <PlusIcon className="w-5 h-5" color="white" />
          )}
        </button>
        <h3 
          className="md:text-[max(1.5vw,18px)] cursor-pointer" 
          onClick={toggleFAQ}
        >
          {question}
        </h3>
      </div>
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <p className="h-full pt-2 pb-5 text-[max(1.5vw,100px)] 2xl:text-[18px]">
          {answer}
        </p>
      </div>
      <hr className="mt-4 w-full border-t border-gray-300" />
    </div>
  )
}
