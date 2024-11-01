//Generate pretty links for teams or citizens, name => tokenId

type PrettyLinkData = {
  name: string
  id: string | number
}

export function generatePrettyLinks(prettyLinkData: PrettyLinkData[]) {
  // Create an object to store the pretty links with their indices
  const prettyLinks: Record<string, string | number> = {}
  const idToPrettyLink: Record<string | number, string> = {}

  // Loop through the citizens or teams
  for (let i = 0; i < prettyLinkData.length; i++) {
    // Take the name and replace spaces with hyphens
    const name = prettyLinkData[i]?.name.toLowerCase() as string
    const id = prettyLinkData[i]?.id as string
    let prettyLink = name.replace(/\s+/g, '-')

    // Ensure unique keys by appending the index if necessary
    while (prettyLinks.hasOwnProperty(prettyLink)) {
      prettyLink = `${prettyLink}-${i}`
    }

    // Map the pretty link to its index
    prettyLinks[prettyLink] = id
    idToPrettyLink[id] = prettyLink
  }

  // Return the object
  return { prettyLinks, idToPrettyLink }
}
