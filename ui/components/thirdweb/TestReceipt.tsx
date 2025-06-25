import { useState } from 'react'
import { waitForReceipt } from 'thirdweb'
import { sepolia } from '@/lib/infura/infuraChains'
import client from '@/lib/thirdweb/client'

interface TestReceiptProps {
  transactionHash?: string
}

// Custom replacer function to handle BigInt serialization
const bigIntReplacer = (key: string, value: any) => {
  if (typeof value === 'bigint') {
    return value.toString()
  }
  return value
}

export default function TestReceipt({ transactionHash }: TestReceiptProps) {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const testReceipt = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    if (!transactionHash) {
      setError('No transaction hash provided')
      setLoading(false)
      return
    }

    try {
      console.log(`Testing receipt fetch for Sepolia`)
      console.log(`Transaction hash: ${transactionHash}`)

      const receipt = await waitForReceipt({
        client: client,
        chain: sepolia,
        transactionHash: transactionHash as `0x${string}`,
      })

      console.log('Receipt received:', receipt)
      setResult(receipt)
    } catch (err: any) {
      console.error('Error fetching receipt:', err)
      setError(err.message || 'Failed to fetch receipt')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2
        className="text-xl font-semibold mb-4"
        data-testid="test-receipt-title"
      >
        Test Receipt Fetching
      </h2>

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">Transaction Hash:</p>
        <p
          className="font-mono text-sm bg-gray-100 p-2 rounded"
          data-testid="tx-hash-display"
        >
          {transactionHash}
        </p>
      </div>

      <button
        onClick={testReceipt}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
        data-testid="fetch-receipt-button"
      >
        {loading ? 'Fetching...' : 'Fetch Receipt'}
      </button>

      {error && (
        <div
          className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded"
          data-testid="error-message"
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div
          className="mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded"
          data-testid="success-message"
        >
          <strong>Success!</strong> Receipt fetched successfully.
          <details className="mt-2">
            <summary className="cursor-pointer">View Receipt Details</summary>
            <pre
              className="mt-2 text-sm overflow-auto"
              data-testid="receipt-data"
            >
              {JSON.stringify(result, bigIntReplacer, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}
