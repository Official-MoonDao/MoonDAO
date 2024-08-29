export default function cleanData(obj: any) {
  const formattedObj: any = {}

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      let formattedString = obj[key] // Directly assign obj[key] to formattedString

      // Check if the value is a string before attempting to replace
      if (typeof formattedString === 'string') {
        //Escape single quote with double single quotes
        formattedString = formattedString.replace(/'/g, "''")
        // Replace emojis with nothing
        formattedString = formattedString.replace(
          /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
          ''
        )
      }

      // Add the key and the potentially modified value to the new object
      formattedObj[key] = formattedString
    }
  }

  return formattedObj
}
