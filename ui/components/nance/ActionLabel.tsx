import { Action, RequestBudget } from '@nance/nance-sdk'
import { formatNumberUSStyle } from '@/lib/nance'
import { TokenSymbol } from './TokenSymbol'

export default function ActionLabel({ action }: { action: Action }) {
  const comment = '// Unrecognized action, please check';

  if (action.type === 'Request Budget') {
    const requestBudget = action.payload as RequestBudget;

    return (
      <div className="flex w-full flex-col break-words">
        <div className="ml-5 md:ml-0 flex flex-col space-y-5">
          {/* Requested Amount(s) and Justification(s) */}
          {requestBudget.budget.length > 0 && ( // Check if budget is not empty
            <div className="bg-dark-cool p-10 mb-3 lg:mb-0 rounded-[20px]">
              <h3 className="text-gray-400 pb-2 font-GoodTimes">Financing</h3>
              {requestBudget.budget.map((item, index) => (
                <div key={index} className="font-semibold">
                  <div className="font-bold text-lg">
                    {formatNumberUSStyle(item.amount)}{' '}
                    <TokenSymbol address={item.token} />
                  </div>
                  <div className='mb-5'>{item.justification}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-gray-400">{comment}</p>
      <p>{JSON.stringify(action)}</p>
    </div>
  );
}
