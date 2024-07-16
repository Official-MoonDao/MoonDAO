import { answerByFieldId } from './answerByFieldId'

export type TeamData = {
  name: string
  description: string
  twitter: string
  communications: string
  website: string
  view: string
  formResponseId: string
}

export default function formatTeamFormData(answers: any[], responseId: string) {
  console.log(answers)
  return {
    name: answerByFieldId(answers, 'ODbjYccwMg1E').text,
    description: answerByFieldId(answers, 'Cg2Wv2FOW3wN')?.text || '',
    twitter: answerByFieldId(answers, 'gpyKF4T4oSsH')?.url || '',
    communications: answerByFieldId(answers, '3cGtidMEK0LA')?.url || '',
    website: answerByFieldId(answers, 'ypWYK8jHAPXf')?.url || '',
    view:
      answerByFieldId(answers, 'MfYME9ERpJR6').boolean === true
        ? 'public'
        : 'private',
    formResponseId: responseId,
  } as TeamData
}
