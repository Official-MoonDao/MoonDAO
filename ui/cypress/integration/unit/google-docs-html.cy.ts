import { htmlToMarkdown } from '@/pages/api/google/docs/fetch'

describe('htmlToMarkdown ordered lists', () => {
  it('keeps Google Docs numbered-list item text', () => {
    const html = `
      <p><span>The term has four priorities:</span></p>
      <ol class="c9 lst-kix_fdpzm98qycgi-0 start" start="1">
        <li class="c3 c8 li-bullet-0"><span>Publicly launch </span><span class="c1">Moon Base Zero</span><span>, the to-scale lunar settlement simulation.</span></li>
        <li class="c3 c8 li-bullet-0"><span>Follow through on the </span><span class="c1">Overview Effect Flight</span><span>.</span></li>
        <li class="c3 c8 li-bullet-0"><span>Grow the </span><span class="c1">Space Acceleration Network</span><span>.</span></li>
        <li class="c3 c8 li-bullet-0"><span>Use current AI agents to </span><span class="c1">automate most recurring DAO operations</span><span>.</span></li>
      </ol>
    `

    const markdown = htmlToMarkdown(html)

    expect(markdown).to.include('1. Publicly launch Moon Base Zero, the to-scale lunar settlement simulation.')
    expect(markdown).to.include('2. Follow through on the Overview Effect Flight.')
    expect(markdown).to.include('3. Grow the Space Acceleration Network.')
    expect(markdown).to.include('4. Use current AI agents to automate most recurring DAO operations.')
    expect(markdown).to.not.match(/1\.\s+2\.\s+3\.\s+4\./)
  })

  it('honors the start attribute on a later ordered list', () => {
    const html = `<ol start="3"><li><span>Third lead</span></li><li><span>Fourth lead</span></li></ol>`
    const markdown = htmlToMarkdown(html)

    expect(markdown).to.include('3. Third lead')
    expect(markdown).to.include('4. Fourth lead')
  })

  it('decodes comparison and arrow entities used in budget tables', () => {
    const html = `<p>Total cash &ge; $18,000 and hours &le; 10. Fee is 2 &times; the base &rarr; treasury.</p>`
    const markdown = htmlToMarkdown(html)

    expect(markdown).to.include('Total cash ≥ $18,000 and hours ≤ 10. Fee is 2 × the base → treasury.')
  })

  it('still keeps unordered list text', () => {
    const html = `<ul><li><span class="c1">DePrize went from design to deployment.</span><span>&nbsp;The shared market stack is live.</span></li></ul>`
    const markdown = htmlToMarkdown(html)

    expect(markdown).to.include('- DePrize went from design to deployment. The shared market stack is live.')
  })
})
