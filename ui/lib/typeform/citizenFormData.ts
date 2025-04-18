import { answerByFieldId } from './answerByFieldId'

export type CitizenData = {
  name: string
  email: string
  description?: string
  location?: string
  discord?: string
  twitter?: string
  website?: string
  view?: string
  formResponseId: string
}

export function formatCitizenFormData(answers: any[], responseId: string) {
  return {
    name: answerByFieldId(answers, 'RkBAEVN40hLw').text,
    email: answerByFieldId(answers, 'LzGGOX3e8Sfv').email,
    description: answerByFieldId(answers, 'PtIcC6l6F5bl')?.text || '',
    discord: answerByFieldId(answers, 'WzZ35V8MLS4J')?.text || '',
    website: answerByFieldId(answers, 'RXW5Ij2CH5g3')?.url || '',
    twitter: answerByFieldId(answers, 'oHfMqgeSg3sa')?.url || '',
    location: answerByFieldId(answers, 'pP6s24aIwEl7')?.text || '',
    view:
      answerByFieldId(answers, 'W0uayCnonUN7').boolean === true
        ? 'public'
        : 'private',
    formResponseId: responseId,
  } as CitizenData
}

export function formatCitizenShortFormData(answers: any[], responseId: string) {
  return {
    name: answerByFieldId(answers, '14C5JA01MntJ').text,
    email: answerByFieldId(answers, 'JEiG9XCW6M73').email,
    formResponseId: responseId,
  } as CitizenData
}
