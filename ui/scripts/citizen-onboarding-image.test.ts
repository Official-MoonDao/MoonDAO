import {
  decideImageResumeAction,
  getGenerationSourceImage,
  getReviewPreviewFile,
  hasAiPortraitImage,
  isGeneratedAiPortraitFile,
  isUsableAiPortrait,
} from '../lib/image-generator/citizenOnboardingImage'
import { comfyJobStatusUrl, parseComfyJobStatus } from '../lib/image-generator/pollComfyImageJob'

function mockFile(name: string): File {
  return new File(['x'], name, { type: 'image/png' })
}

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`)
  }
}

function expectTruthy(value: unknown, label: string) {
  if (!value) throw new Error(`${label}: expected truthy, got ${value}`)
}

function expectFalsy(value: unknown, label: string) {
  if (value) throw new Error(`${label}: expected falsy, got ${value}`)
}

describe('citizenOnboardingImage', () => {
  it('getGenerationSourceImage uses only the crop', () => {
    const full = mockFile('full.png')
    const crop = mockFile('crop.png')
    expectEqual(getGenerationSourceImage(crop, full), crop, 'crop+full')
    expectEqual(getGenerationSourceImage(undefined, full), undefined, 'full only')
  })

  it('getReviewPreviewFile returns AI portrait when ready', () => {
    const crop = mockFile('crop.png')
    const ai = mockFile('ai.png')
    const result = getReviewPreviewFile({
      citizenImage: ai,
      croppedInputImage: crop,
      isImageGenerating: false,
      hasPendingImageJob: false,
      aiPortraitReady: true,
    })
    expectEqual(result, ai, 'ai portrait')
  })

  it('getReviewPreviewFile never uses full input while awaiting AI', () => {
    const full = mockFile('full.png')
    const crop = mockFile('crop.png')
    const result = getReviewPreviewFile({
      citizenImage: undefined,
      croppedInputImage: crop,
      inputImage: full,
      isImageGenerating: true,
      hasPendingImageJob: false,
      aiPortraitReady: false,
    })
    expectEqual(result, crop, 'cropped while waiting')
  })

  it('getReviewPreviewFile does not show full input when crop missing', () => {
    const full = mockFile('full.png')
    const result = getReviewPreviewFile({
      citizenImage: undefined,
      croppedInputImage: undefined,
      inputImage: full,
      isImageGenerating: true,
      hasPendingImageJob: true,
      aiPortraitReady: false,
    })
    expectEqual(result, null, 'no preview without crop')
  })

  it('getReviewPreviewFile ignores stale citizenImage without ai flag', () => {
    const full = mockFile('full.png')
    const crop = mockFile('crop.png')
    const stale = mockFile('stale-fitted.png')
    const result = getReviewPreviewFile({
      citizenImage: stale,
      croppedInputImage: crop,
      inputImage: full,
      isImageGenerating: true,
      hasPendingImageJob: false,
      aiPortraitReady: false,
    })
    expectEqual(result, crop, 'crop over stale citizen')
  })

  it('hasAiPortraitImage is false when citizen equals crop', () => {
    const crop = mockFile('crop.png')
    expectFalsy(hasAiPortraitImage(crop, crop), 'same file ref')
  })

  // The exact reported bug: after Privy returns the cropped image failed to
  // persist (storage quota), but a comfy job was already polling. We MUST still
  // resume polling so the AI image is delivered — not show "complete previous steps".
  it('resumes polling without a source image (Privy quota-loss case)', () => {
    const action = decideImageResumeAction({
      job: { status: 'polling', jobId: 'abc123' },
      jobStale: false,
      hasAiPortraitReady: false,
      hasSourceImage: false,
    })
    expectEqual(action, 'resume-polling', 'polling resumes without source')
  })

  it('resumes polling when source image is present', () => {
    const action = decideImageResumeAction({
      job: { status: 'polling', jobId: 'abc123' },
      jobStale: false,
      hasAiPortraitReady: false,
      hasSourceImage: true,
    })
    expectEqual(action, 'resume-polling', 'polling resumes with source')
  })

  it('restarts an uploading job only when a source image survived', () => {
    expectEqual(
      decideImageResumeAction({
        job: { status: 'uploading' },
        jobStale: false,
        hasAiPortraitReady: false,
        hasSourceImage: true,
      }),
      'restart-generation',
      'uploading + source restarts'
    )
    expectEqual(
      decideImageResumeAction({
        job: { status: 'uploading' },
        jobStale: false,
        hasAiPortraitReady: false,
        hasSourceImage: false,
      }),
      'none',
      'uploading without source cannot restart'
    )
  })

  // The exact reported bug: comfy.icu jobs were completing successfully, but
  // citizens who took a while to return (e.g. funding their wallet via
  // onramp) had their local job timer exceed the staleness window, so a
  // finished portrait was silently discarded and the mint fell back to the
  // raw uploaded photo. A 'polling' job's jobId stays valid on comfy.icu far
  // longer than the local staleness window, so staleness alone must not
  // block resuming it.
  it('resumes a stale polling job instead of discarding a finished portrait', () => {
    const action = decideImageResumeAction({
      job: { status: 'polling', jobId: 'x' },
      jobStale: true,
      hasAiPortraitReady: false,
      hasSourceImage: true,
    })
    expectEqual(action, 'resume-polling', 'stale polling job still resumes')
  })

  it('does nothing for a stale uploading job or when AI portrait already ready', () => {
    expectEqual(
      decideImageResumeAction({
        job: { status: 'uploading' },
        jobStale: true,
        hasAiPortraitReady: false,
        hasSourceImage: true,
      }),
      'none',
      'stale uploading job ignored (no jobId to recover)'
    )
    expectEqual(
      decideImageResumeAction({
        job: { status: 'polling', jobId: 'x' },
        jobStale: false,
        hasAiPortraitReady: true,
        hasSourceImage: true,
      }),
      'none',
      'already have AI portrait'
    )
    expectEqual(
      decideImageResumeAction({
        job: null,
        jobStale: true,
        hasAiPortraitReady: false,
        hasSourceImage: true,
      }),
      'none',
      'no job'
    )
  })

  // While polling resumes with no cropped image, the preview shows the progress
  // overlay (null file) rather than the empty "complete previous steps" state.
  it('review preview is progress-only (null) while polling without a crop', () => {
    const preview = getReviewPreviewFile({
      citizenImage: undefined,
      croppedInputImage: undefined,
      inputImage: undefined,
      isImageGenerating: true,
      hasPendingImageJob: true,
      aiPortraitReady: false,
    })
    expectEqual(preview, null, 'no underlying image, progress overlay only')
  })

  // Regression: after Privy return, cache often had full input + stale fitted citizenImage
  // but not aiPortraitReady — old UI showed the full upload on Review.
  it('treats comfy download filenames as AI even when the session flag is missing', () => {
    const crop = mockFile('face-crop.jpg')
    const ai = mockFile('image_VE52rnl_BVdbgou9tQbEF.png')
    expectTruthy(isGeneratedAiPortraitFile(ai), 'png job filename')
    expectTruthy(
      isGeneratedAiPortraitFile(mockFile('image_VE52rnl_BVdbgou9tQbEF.jpg')),
      'restored jpeg'
    )
    expectFalsy(isGeneratedAiPortraitFile(crop), 'user crop filename')
    expectTruthy(isUsableAiPortrait(ai, crop, false), 'usable without session flag')

    const preview = getReviewPreviewFile({
      citizenImage: ai,
      croppedInputImage: crop,
      isImageGenerating: false,
      hasPendingImageJob: false,
      aiPortraitReady: false,
    })
    expectEqual(preview, ai, 'AI file wins without session flag')
  })

  it('does not treat a fitted fallback as AI just because it is a different File', () => {
    const crop = mockFile('face-crop.jpg')
    const fitted = mockFile('face-crop.jpg')
    expectFalsy(isGeneratedAiPortraitFile(fitted), 'fallback keeps user filename')
    expectFalsy(isUsableAiPortrait(fitted, crop, false), 'fallback is not AI without flag')
  })

  it('polls a single comfy run by id instead of listing every job', () => {
    expectEqual(
      comfyJobStatusUrl('/api/image-gen/citizen-image', 'VE52rnl_BVdbgou9tQbEF'),
      '/api/image-gen/citizen-image?id=VE52rnl_BVdbgou9tQbEF',
      'status url'
    )
    const job = { id: 'VE52rnl_BVdbgou9tQbEF', status: 'COMPLETED' }
    expectEqual(parseComfyJobStatus(job, 'VE52rnl_BVdbgou9tQbEF'), job, 'single-run payload')
    expectEqual(
      parseComfyJobStatus([job, { id: 'other' }], 'VE52rnl_BVdbgou9tQbEF'),
      job,
      'legacy list payload'
    )
    try {
      parseComfyJobStatus({ id: 'other' }, 'VE52rnl_BVdbgou9tQbEF')
      throw new Error('expected mismatched id to throw')
    } catch (err: any) {
      if (!String(err?.message).includes('did not match')) {
        throw err
      }
    }
  })

  it('Privy-return regression: stale full-size citizenImage must not win over crop', () => {
    const full = mockFile('vacation-full.jpg')
    const crop = mockFile('face-crop.jpg')
    const staleFittedFull = mockFile('fitted-full.jpg')
    const preview = getReviewPreviewFile({
      citizenImage: staleFittedFull,
      croppedInputImage: crop,
      inputImage: full,
      isImageGenerating: true,
      hasPendingImageJob: true,
      aiPortraitReady: false,
    })
    expectEqual(preview, crop, 'review shows crop while job pending')
    expectTruthy(preview !== full, 'must not preview full upload')
  })
})
