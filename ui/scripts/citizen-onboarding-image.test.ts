import {
  decideImageResumeAction,
  getGenerationSourceImage,
  getReviewPreviewFile,
  hasAiPortraitImage,
} from '../lib/image-generator/citizenOnboardingImage'

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
      'uploading + source restarts',
    )
    expectEqual(
      decideImageResumeAction({
        job: { status: 'uploading' },
        jobStale: false,
        hasAiPortraitReady: false,
        hasSourceImage: false,
      }),
      'none',
      'uploading without source cannot restart',
    )
  })

  it('does nothing for stale jobs or when AI portrait already ready', () => {
    expectEqual(
      decideImageResumeAction({
        job: { status: 'polling', jobId: 'x' },
        jobStale: true,
        hasAiPortraitReady: false,
        hasSourceImage: true,
      }),
      'none',
      'stale job ignored',
    )
    expectEqual(
      decideImageResumeAction({
        job: { status: 'polling', jobId: 'x' },
        jobStale: false,
        hasAiPortraitReady: true,
        hasSourceImage: true,
      }),
      'none',
      'already have AI portrait',
    )
    expectEqual(
      decideImageResumeAction({
        job: null,
        jobStale: true,
        hasAiPortraitReady: false,
        hasSourceImage: true,
      }),
      'none',
      'no job',
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
