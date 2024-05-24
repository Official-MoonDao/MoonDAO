import { answerByFieldId } from './answerByFieldId'

export type EntityData = {
  name: string
  description: string
  twitter: string
  communications: string
  website: string
  view: string
  formResponseId: string
}

export default function formatEntityFormData(
  answers: any[],
  responseId: string
) {
  return {
    name: answerByFieldId(answers, 'aYPTOtKo0en0').text,
    description: answerByFieldId(answers, 'TGICeck61q0r')?.text || '',
    twitter: answerByFieldId(answers, 'ti5k7RkHB6kD')?.url || '',
    communications: answerByFieldId(answers, '0TKNKT8IKsqN')?.text || '',
    website: answerByFieldId(answers, 'Nx3JEhTiY2se')?.url || '',
    view:
      answerByFieldId(answers, 'fOKwAkJnJuQH').choice.label === 'Yes'
        ? 'public'
        : 'private',
    formResponseId: responseId,
  } as EntityData
}
