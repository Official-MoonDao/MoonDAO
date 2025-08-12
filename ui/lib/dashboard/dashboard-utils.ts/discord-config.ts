type Dictionary = { [key: string]: string[] }

export const discordRoleDictionary: Dictionary = {
  // Core leadership roles
  '914973269709447238': ['text-yellow-500', 'Astronaut'],
  '1133787490180939817': ['text-rose-700', 'Executive'],
  
  // Governance roles (now with actual Discord role IDs)
  '1075100215406764143': ['text-blue-500', 'Senator'],
  '914997939905101874': ['text-emerald-400', 'Project Lead'],
  
  // Project and community roles
  '915011037017817149': ['text-purple-500', 'Project Contributor'],
  
  // Voting and citizenship (actual role IDs from config)
  '1075090331055435786': ['text-blue-600', 'Voter'],
  '1293939046774739106': ['text-indigo-500', 'Citizen'],
  '1331745916117323849': ['text-indigo-500', 'Citizen'], // testnet
  
  // Token holder roles
  '1000243495803555940': ['text-blue-700', '$MOONEY Whale'],
  '978030442781483038': ['text-rose-500', '$MOONEY Millionaire'],
  '1000242931254431844': ['text-orange-700', '$MOONEY Shark'],
  '945287897588846672': ['text-lime-500', '$MOONEY HODLER'],
  
  // Other community roles
  '983904866021802074': ['text-zinc-500', 'Ticket To Space Holder'],
  '914998572859142185': ['text-blue-500', 'Alien'],
  '1096152084782522448': ['text-indigo-600', 'MoonDAOcrew'],
  '1044672824243138560': ['text-rose-600', 'CN Member'],
  '941227401290067998': ['text-emerald-500', 'MoonDAO World'],
  '1046539204018045099': ['text-yellow-500', 'Member'],
}

/*
    
    This affects the color of role mentions within the Discord Announcements.
  
    Update following this pattern:
  
    ROLE ID FROM DISCORD : [ "TAILWINDCSS STYLES" , "ROLE NAME"]
  
    Currently just changing colors, but properties like text size or underlining could also be changed in this way.
    
    */

export const discordChannelDictionary: Dictionary = {
  '914720248140279871': ['text-emerald-400', 'general'],
  '1038333409166106684': ['text-sky-500', 'general-forum'],
  '914976122855374958': ['text-yellow-500', 'announcements'],
  '923068372428660736': ['text-orange-700', 'event-calendar'],
  '930114264570667009': ['text-orange-800', 'moondao-links'],
  '914990779850715227': ['text-blue-700', 'welcome'],
  '996265022936334397': ['text-purple-500', 'notes-and-agenda'],
  '914995674326655076': ['text-rose-700', 'dev-guild'],
  '914994558679543848': ['text-lime-500', 'growth-guild'],
  '1037194112551616512': ['text-blue-700', 'community-guild'],
  '1038869242944163931': ['text-blue-500', 'twitter-raid'],
  '1087835786147278938': ['text-amber-600', 'guild-onboarding'],
  '1047733783069196349': ['text-emerald-500', 'partnership-and-amas'],
  '998703720818802758': ['text-blue-500', 'support'],
  '945284940721975356': ['text-amber-500', 'verify-roles'],
  '998700058499358810': ['text-orange-500', 'onboarding'],
  '1027658256706961509': ['text-blue-500', 'ideation'],
  '1120720381943238747': ['text-blue-500', 'Voters-Lounge'],
  '1108965136074559509': ['text-moon-blue dark:text-detail-dark', 'Official-Links'],
}

/*
        
        This affects the color of Channel mentions within the Discord Announcements.
      
        Update following this pattern:
      
        Channel ID FROM DISCORD : [ "TAILWINDCSS STYLES" , "ROLE NAME"]
      
        Currently just changing colors, but properties like text size or underlining could also be changed in this way.
        
        */
