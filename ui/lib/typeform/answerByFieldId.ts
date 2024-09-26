export function answerByFieldId(answers: any[], fieldId: string) {
  return answers.find((answer) => answer.field.id === fieldId)
}
