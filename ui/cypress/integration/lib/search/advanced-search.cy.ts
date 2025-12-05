import { parseSearchQuery, matchesAdvancedSearch } from '@/lib/search/advancedSearch'

describe('parseSearchQuery', () => {
  it('parses simple terms as required', () => {
    const result = parseSearchQuery('budget planning')
    
    expect(result.requiredTerms).to.deep.equal(['budget', 'planning'])
    expect(result.optionalTerms).to.deep.equal([])
    expect(result.excludedTerms).to.deep.equal([])
    expect(result.phrases).to.deep.equal([])
  })

  it('extracts phrases from quotes', () => {
    const result = parseSearchQuery('"town hall meeting"')
    
    expect(result.phrases).to.deep.equal(['town hall meeting'])
    expect(result.requiredTerms).to.deep.equal([])
  })

  it('handles OR operator for optional terms', () => {
    const result = parseSearchQuery('budget OR funding')
    
    expect(result.optionalTerms).to.include('budget')
    expect(result.optionalTerms).to.include('funding')
    expect(result.requiredTerms).to.deep.equal([])
  })

  it('handles NOT operator for exclusions', () => {
    const result = parseSearchQuery('budget NOT rejected')
    
    expect(result.requiredTerms).to.deep.equal(['budget'])
    expect(result.excludedTerms).to.deep.equal(['rejected'])
  })

  it('handles minus prefix for exclusions', () => {
    const result = parseSearchQuery('budget -spam')
    
    expect(result.requiredTerms).to.deep.equal(['budget'])
    expect(result.excludedTerms).to.deep.equal(['spam'])
  })

  it('handles AND operator explicitly', () => {
    const result = parseSearchQuery('budget AND planning')
    
    expect(result.requiredTerms).to.deep.equal(['budget', 'planning'])
  })

  it('handles combined queries', () => {
    const result = parseSearchQuery('"town hall" OR meeting budget -rejected')
    
    expect(result.phrases).to.deep.equal(['town hall'])
    expect(result.optionalTerms).to.include('meeting')
    expect(result.requiredTerms).to.include('budget')
    expect(result.excludedTerms).to.deep.equal(['rejected'])
  })

  it('handles empty query', () => {
    const result = parseSearchQuery('')
    
    expect(result.requiredTerms).to.deep.equal([])
    expect(result.optionalTerms).to.deep.equal([])
    expect(result.excludedTerms).to.deep.equal([])
    expect(result.phrases).to.deep.equal([])
  })

  it('normalizes terms to lowercase', () => {
    const result = parseSearchQuery('BUDGET Planning')
    
    expect(result.requiredTerms).to.deep.equal(['budget', 'planning'])
  })
})

describe('matchesAdvancedSearch', () => {
  it('matches exact words with word boundaries', () => {
    const text = 'June is the sixth month'
    
    expect(matchesAdvancedSearch(text, 'June')).to.be.true
    expect(matchesAdvancedSearch(text, 'jun')).to.be.false
  })

  it('does not match partial words', () => {
    const text = 'conjunction of events'
    
    expect(matchesAdvancedSearch(text, 'June')).to.be.false
  })

  it('matches phrases in quotes', () => {
    const text = 'The town hall meeting was productive'
    
    expect(matchesAdvancedSearch(text, '"town hall"')).to.be.true
    expect(matchesAdvancedSearch(text, '"hall meeting"')).to.be.true
    expect(matchesAdvancedSearch(text, '"meeting town"')).to.be.false
  })

  it('handles OR logic - matches when any term present', () => {
    const text = 'Budget planning for next quarter'
    
    expect(matchesAdvancedSearch(text, 'budget OR funding')).to.be.true
    expect(matchesAdvancedSearch(text, 'funding OR budget')).to.be.true
    expect(matchesAdvancedSearch(text, 'funding OR grants')).to.be.false
  })

  it('handles NOT logic - excludes when term present', () => {
    const text = 'Budget was rejected by the committee'
    
    expect(matchesAdvancedSearch(text, 'budget NOT rejected')).to.be.false
    expect(matchesAdvancedSearch(text, 'budget NOT approved')).to.be.true
  })

  it('handles exclusion with minus prefix', () => {
    const text = 'Budget planning session'
    
    expect(matchesAdvancedSearch(text, 'budget -rejected')).to.be.true
    expect(matchesAdvancedSearch(text, 'budget -planning')).to.be.false
  })

  it('handles AND logic - requires all terms', () => {
    const text = 'Budget and planning committee meeting'
    
    expect(matchesAdvancedSearch(text, 'budget AND planning')).to.be.true
    expect(matchesAdvancedSearch(text, 'budget planning')).to.be.true
    expect(matchesAdvancedSearch(text, 'budget AND funding')).to.be.false
  })

  it('handles complex multi-operator queries', () => {
    const text = 'Town hall meeting about budget planning'
    
    expect(matchesAdvancedSearch(text, '"town hall" budget -rejected')).to.be.true
    expect(matchesAdvancedSearch(text, '"town hall" funding -rejected')).to.be.false
    expect(matchesAdvancedSearch(text, 'meeting OR assembly budget')).to.be.true
  })

  it('is case insensitive', () => {
    const text = 'BUDGET PLANNING'
    
    expect(matchesAdvancedSearch(text, 'budget')).to.be.true
    expect(matchesAdvancedSearch(text, 'Budget')).to.be.true
    expect(matchesAdvancedSearch(text, 'BUDGET')).to.be.true
  })

  it('handles empty search query', () => {
    const text = 'Some text here'
    
    expect(matchesAdvancedSearch(text, '')).to.be.true
  })

  it('returns false when no matches found', () => {
    const text = 'Budget planning session'
    
    expect(matchesAdvancedSearch(text, 'rejected')).to.be.false
    expect(matchesAdvancedSearch(text, '"town hall"')).to.be.false
  })
})

