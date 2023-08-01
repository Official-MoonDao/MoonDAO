type Dictionary = { [key: string]: string[] }

export const discordRoleDictionary: Dictionary = {
  '914973269709447238': ['text-yellow-500', 'Astronauts'],
  '921183824614948874': ['text-rose-700', 'Multi-sig'],
  '914997939905101874': ['text-emerald-400', 'Rocketeers'],
  '915011037017817149': ['text-purple-500', 'Moon Settlers'],
  '1000243495803555940': ['text-blue-700', '$MOONEY Whale'],
  '978030442781483038': ['text-rose-500', '$MOONEY Millionaire'],
  '1000242931254431844': ['text-orange-700', '$MOONEY Shark'],
  '945287897588846672': ['text-lime-500', '$MOONEY HODLER'],
  '983904866021802074': ['text-zinc-500', 'Ticket To Space Holder'],
  '941227287007866883': ['text-sky-500', 'DAO Contributor'],
  '914998572859142185': ['text-blue-500', 'Earthlings'],
  '1096152084782522448': ['text-indigo-600', 'MoonDAOcrew'],
  '1044672824243138560': ['text-rose-600', 'CN Member'],
  '941227401290067998': ['text-emerald-500', 'MoonDAO World'],
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
}

/*
        
        This affects the color of Channel mentions within the Discord Announcements.
      
        Update following this pattern:
      
        Channel ID FROM DISCORD : [ "TAILWINDCSS STYLES" , "ROLE NAME"]
      
        Currently just changing colors, but properties like text size or underlining could also be changed in this way.
        
        */
