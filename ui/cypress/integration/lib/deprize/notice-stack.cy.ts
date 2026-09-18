import { pickNotices, type NoticeItemBase } from '@/lib/deprize/noticeStack'

describe('NoticeStack ranking', () => {
  it('keeps every red notice and only the highest-priority amber notice', () => {
    const items: NoticeItemBase<string>[] = [
      { id: 'onramp', tone: 'amber', priority: 2, body: 'connect' },
      { id: 'market', tone: 'red', priority: 0, body: 'reload' },
      { id: 'closed', tone: 'amber', priority: 3, body: 'closed' },
      { id: 'wallet', tone: 'amber', priority: 1, body: 'wrong wallet' },
    ]
    expect(pickNotices(items).map((item) => item.id)).to.deep.equal(['market', 'wallet'])
  })

  it('renders nothing when the list is empty', () => {
    expect(pickNotices([])).to.deep.equal([])
  })
})
