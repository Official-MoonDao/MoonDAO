import React from 'react'
import { CalendarIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline'

interface ProposalSubmissionCTAProps {
  proposalId?: string
  onClose?: () => void
}

export default function ProposalSubmissionCTA({ proposalId, onClose }: ProposalSubmissionCTAProps) {
  // Discord URLs for MoonDAO
  const PROPOSALS_CHANNEL = 'https://discord.com/channels/914720248140279868/1027658256706961509'
  const LUMA_CALENDAR = 'https://lu.ma/moondao'

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2 font-GoodTimes">
            Proposal Submitted Successfully! 🚀
          </h2>
          <p className="text-gray-300 text-lg">
            Your proposal is now live and ready for community discussion.
          </p>
        </div>

        <div className="space-y-6">
          {/* Next Steps Header */}
          <div className="text-center">
            <h3 className="text-xl font-semibold text-white mb-4">
              📋 Next Steps for Your Proposal
            </h3>
          </div>

          {/* Townhall CTA */}
          <div className="bg-black/20 rounded-xl p-6 border border-white/10">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <CalendarIcon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-white mb-2">
                  1. Attend the Next Town Hall
                </h4>
                <p className="text-gray-300 mb-4">
                  Present your proposal to the community and answer questions during our weekly town hall meetings. This is crucial for building support and gathering feedback.
                </p>
                <a
                  href={LUMA_CALENDAR}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105"
                >
                  View Town Hall Schedule
                  <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Discord CTA */}
          <div className="bg-black/20 rounded-xl p-6 border border-white/10">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <ChatBubbleLeftIcon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-white mb-2">
                  2. Follow Up in Discord
                </h4>
                <p className="text-gray-300 mb-4">
                  Share your proposal in the #ideation channel to engage with the community, gather feedback, and build consensus before the voting period.
                </p>
                <a
                  href={PROPOSALS_CHANNEL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105"
                >
                  Join Proposals Discussion
                  <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Pro Tips */}
          <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl p-6 border border-yellow-500/20">
            <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
              <span className="text-xl mr-2">💡</span>
              Pro Tips for Success
            </h4>
            <ul className="text-gray-300 space-y-2 text-sm">
              <li className="flex items-start">
                <span className="text-yellow-400 mr-2">•</span>
                Be prepared to present your proposal concisely during town hall (3-5 minutes)
              </li>
              <li className="flex items-start">
                <span className="text-yellow-400 mr-2">•</span>
                Engage with community feedback and be open to iterations
              </li>
              <li className="flex items-start">
                <span className="text-yellow-400 mr-2">•</span>
                Build support by networking with other community members
              </li>
              <li className="flex items-start">
                <span className="text-yellow-400 mr-2">•</span>
                Address questions and concerns promptly in Discord
              </li>
            </ul>
          </div>
        </div>

        {/* Close Button */}
        <div className="mt-8 text-center">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-medium rounded-lg transition-all duration-200"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  )
}
