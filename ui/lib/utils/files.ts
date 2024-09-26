export function renameFile(file: File, newName: string) {
  return new File([file], newName, {
    type: file.type,
    lastModified: file.lastModified,
  })
}
