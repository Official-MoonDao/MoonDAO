type PrettyLinkData = {
  name: string
  id: string | number
}

export function generatePrettyLinks(prettyLinkData: PrettyLinkData[]) {
  const prettyLinks: Record<string, string | number> = {}
  const idToPrettyLink: Record<string | number, string> = {}

  for (let i = 0; i < prettyLinkData.length; i++) {
    // Take the name and replace spaces with hyphens
    const name = prettyLinkData[i]?.name?.toLowerCase() as string
    const id = prettyLinkData[i]?.id as string
    let prettyLink = name.replace(/\s+/g, '-')

    // Ensure unique keys by appending the index if necessary
    while (prettyLinks.hasOwnProperty(prettyLink)) {
      prettyLink = `${prettyLink}-${id}`
    }

    prettyLinks[prettyLink] = id
    idToPrettyLink[id] = prettyLink
  }

  // Return the object
  return { prettyLinks, idToPrettyLink }
}
