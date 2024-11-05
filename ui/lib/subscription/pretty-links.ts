type PrettyLinkData = {
  name: string
  id: string | number
}

export function generatePrettyLinks(prettyLinkData: PrettyLinkData[]) {
  const prettyLinks: Record<string, string | number> = {}
  const idToPrettyLink: Record<string | number, string> = {}

  for (let i = 0; i < prettyLinkData.length; i++) {
    const name = prettyLinkData[i]?.name?.toLowerCase()
    const id = prettyLinkData[i]?.id

    if (name && id) {
      let prettyLink = name.replace(/\s+/g, '-')

      // Ensure unique keys by appending the index if necessary
      while (prettyLinks.hasOwnProperty(prettyLink)) {
        prettyLink = `${prettyLink}-${id}`
      }

      prettyLinks[prettyLink] = id
      idToPrettyLink[id] = prettyLink
    }
  }

  // Return the object
  return { prettyLinks, idToPrettyLink }
}
