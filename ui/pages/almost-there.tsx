import React from 'react'
import { EnvelopeIcon } from '@heroicons/react/24/outline'
import Container from '../components/layout/Container'
import WebsiteHead from '../components/layout/Head'
import Link from 'next/link'

const AlmostThere: React.FC = () => {
    return (
        <>
            <WebsiteHead 
                title="Almost There" 
                description="Check your email to confirm your subscription and complete your journey with MoonDAO." 
            />
            <Container>
                <div className="min-h-screen flex items-center justify-center p-4">
                    <div className="w-full max-w-md mx-auto bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white overflow-hidden">
                        {/* Content */}
                        <div className="p-6 space-y-6">
                            <div className="text-center space-y-4">
                                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/30">
                                    <EnvelopeIcon className="w-10 h-10 text-blue-400" />
                                </div>
                                <div>
                                    <h1 className="font-GoodTimes text-2xl font-bold text-white mb-2">
                                        Almost There!
                                    </h1>
                                    <p className="text-gray-300 text-sm leading-relaxed">
                                        Check your email to confirm your subscription. We've sent you a confirmation link to complete the process.
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-3">
                                <Link
                                    href="/"
                                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
                                >
                                    <span>Go to Homepage</span>
                                </Link>
                                <Link
                                    href="/join-us"
                                    className="w-full bg-transparent border border-white/20 hover:bg-white/10 text-white py-3 px-6 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
                                >
                                    <span>Try Again</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </Container>
        </>
    )
}

export default AlmostThere
