type PrettyLinkData = {
  name: string
  id: string | number
}

type Options = {
  allHaveTokenId?: boolean
}

export function generatePrettyLinks(
  prettyLinkData: PrettyLinkData[],
  options: Options = {}
) {
  const prettyLinks: Record<string, string | number> = {}
  const idToPrettyLink: Record<string | number, string> = {}

  for (let i = 0; i < prettyLinkData.length; i++) {
    const name = prettyLinkData[i]?.name?.toLowerCase()
    const id = prettyLinkData[i]?.id

    if (name && id !== null && id !== undefined) {
      let prettyLink = generatePrettyLink(name)

      if (options?.allHaveTokenId) {
        prettyLink = `${prettyLink}-${id}`
      } else {
        while (prettyLinks.hasOwnProperty(prettyLink)) {
          prettyLink = `${prettyLink}-${id}`
        }
      }

      prettyLinks[prettyLink] = id
      idToPrettyLink[id] = prettyLink
    }
  }

  // Return the object
  return { prettyLinks, idToPrettyLink }
}

export function generatePrettyLinkWithId(name: string, id: string | number) {
  if (name && id !== null && id !== undefined) {
    let prettyLink = generatePrettyLink(name)
    prettyLink = `${prettyLink}-${id}`
    return prettyLink
  }
}

export function generatePrettyLink(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-')
}
