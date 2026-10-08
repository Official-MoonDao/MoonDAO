"""Compute report metrics and render charts from data/snapshot.json.

Writes data/metrics.json and charts/*.png.

    python3 docs/reports/eb-mdp-249/scripts/build_charts.py
"""

import collections
import datetime as dt
import json
import os
import re

import matplotlib

matplotlib.use('Agg')
import matplotlib.dates as mdates  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import Patch  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
SNAP = json.load(open(os.path.join(ROOT, 'data', 'snapshot.json')))
CHARTS = os.path.join(ROOT, 'charts')
os.makedirs(CHARTS, exist_ok=True)

UTC = dt.timezone.utc
AS_OF = dt.datetime(2026, 10, 7, 23, 59, tzinfo=UTC)
TERM_START = dt.datetime(2026, 5, 1, tzinfo=UTC)
TERM_END = dt.datetime(2026, 9, 3, 23, 59, tzinfo=UTC)
MONTH4 = dt.datetime(2026, 9, 1, tzinfo=UTC)
STREAM_ETH_USD = 1843.17

NAVY = '#0B1E3F'
BLUE = '#2F6BFF'
VIOLET = '#7B4DFF'
TEAL = '#14B8A6'
AMBER = '#F59E0B'
RED = '#E5484D'
GREY = '#9AA4B2'
LIGHT = '#EEF2F8'

PABLO = '0x679d87d8640e66778c3419d164998e720d7495f6'
RYAN_CITIZEN = '0xb2d3900807094d4fe47405871b0c8adb58e10d42'
RYAN_PAYOUT = '0x78176eaabcb3255e898079dc67428e15149cdc99'
MIGUEL = '0xaf6f2a7643a97b849bd9cf6d3f57e142c5bbb0da'
DEPLOYER = '0x3c5e2fe76478e99d94d3ca8bfa5154907a52e011'
PEOPLE = {PABLO: 'Pablo', RYAN_CITIZEN: 'Ryan', RYAN_PAYOUT: 'Ryan', MIGUEL: 'Miguel'}

TOKENS = {
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831': ('USDC', 6),
    '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1': ('DAI', 18),
    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': ('WETH', 18),
}

plt.rcParams.update(
    {
        'font.family': 'DejaVu Sans',
        'font.size': 10,
        'axes.titlesize': 13,
        'axes.titleweight': 'bold',
        'axes.titlelocation': 'left',
        'axes.edgecolor': '#C9D1DD',
        'axes.labelcolor': NAVY,
        'axes.spines.top': False,
        'axes.spines.right': False,
        'xtick.color': '#4A5568',
        'ytick.color': '#4A5568',
        'axes.grid': True,
        'grid.color': '#E6EAF0',
        'grid.linewidth': 0.8,
        'legend.frameon': False,
        'figure.dpi': 110,
        'savefig.dpi': 200,
        'savefig.bbox': 'tight',
    }
)


def ts(x):
    return dt.datetime.fromtimestamp(int(x), UTC)


def iso(x):
    return dt.datetime.fromisoformat(x.replace('Z', '+00:00'))


def save(fig, name, source, y=-0.02):
    fig.text(0.0, y, f'Source: {source}. As of 7 Oct 2026.', fontsize=7.5, color=GREY, ha='left')
    fig.savefig(os.path.join(CHARTS, name))
    plt.close(fig)


def shade_term(ax):
    ax.axvspan(TERM_START, TERM_END, color=BLUE, alpha=0.06, lw=0)
    ax.axvline(TERM_START, color=BLUE, lw=0.8, ls=':')
    ax.axvline(TERM_END, color=BLUE, lw=0.8, ls=':')


metrics = {}

# ---------------------------------------------------------------- network ---


def nft_series(nft, exclude_ids=()):
    tokens = [t for t in nft['tokens'] if t['mintedAt'] and t['id'] not in exclude_ids]
    days = []
    d = dt.datetime(2025, 1, 1, tzinfo=UTC)
    while d <= AS_OF:
        days.append(d)
        d += dt.timedelta(days=1)
    minted = [sum(1 for t in tokens if t['mintedAt'] <= d.timestamp()) for d in days]
    active = [
        sum(1 for t in tokens if t['mintedAt'] <= d.timestamp() and (t['expiresAt'] or 0) > d.timestamp())
        for d in days
    ]
    return days, minted, active, tokens


def count_at(tokens, when, active=False):
    t0 = when.timestamp()
    return sum(
        1
        for t in tokens
        if t['mintedAt'] <= t0 and (not active or (t['expiresAt'] or 0) > t0)
    )


c_days, c_minted, c_active, c_tokens = nft_series(SNAP['citizenNFT'])
t_days, t_minted, t_active, t_tokens = nft_series(SNAP['teamNFT'], exclude_ids=(0,))

metrics['citizens'] = {
    'mintedAtTermStart': count_at(c_tokens, TERM_START),
    'activeAtTermStart': count_at(c_tokens, TERM_START, True),
    'mintedAtMonth4': count_at(c_tokens, MONTH4),
    'mintedAtTermEnd': count_at(c_tokens, TERM_END),
    'mintedAsOf': count_at(c_tokens, AS_OF),
    'activeAsOf': count_at(c_tokens, AS_OF, True),
    'target': 300,
    'baseline': 199,
}
metrics['teams'] = {
    'externalAtTermStart': count_at(t_tokens, TERM_START),
    'externalAtMonth4': count_at(t_tokens, MONTH4),
    'externalAsOf': count_at(t_tokens, AS_OF),
    'activeAsOf': count_at(t_tokens, AS_OF, True),
    'target': 30,
    'baseline': 20,
    'newInTerm': [
        {'id': t['id'], 'mintedAt': ts(t['mintedAt']).date().isoformat()}
        for t in t_tokens
        if t['mintedAt'] >= TERM_START.timestamp()
    ],
}
team_names = {int(t['id']): t['name'] for t in SNAP['teamsTable']}
for t in metrics['teams']['newInTerm']:
    t['name'] = team_names.get(t['id'], f"Team {t['id']}")

fig, ax = plt.subplots(figsize=(9, 4.2))
shade_term(ax)
ax.plot(c_days, c_minted, color=BLUE, lw=2.2, label='Citizens minted (cumulative)')
ax.plot(c_days, c_active, color=TEAL, lw=2.0, label='Active Citizens (current expiry)')
ax.axhline(300, color=RED, lw=1.2, ls='--')
ax.text(c_days[5], 303, 'KR target: 300 by month 4', color=RED, fontsize=8.5, va='bottom')
ax.axhline(199, color=GREY, lw=1, ls='--')
ax.text(c_days[5], 192, 'Baseline: 199', color=GREY, fontsize=8.5, va='top')
ax.annotate(
    f"{metrics['citizens']['mintedAsOf']} minted\n{metrics['citizens']['activeAsOf']} active",
    xy=(c_days[-1], c_minted[-1]), xytext=(-70, 18), textcoords='offset points',
    fontsize=9, color=NAVY, arrowprops=dict(arrowstyle='-', color=GREY),
)
ax.set_title('Citizen growth — Space Acceleration Network')
ax.set_ylabel('Citizens')
ax.set_ylim(0, 330)
ax.xaxis.set_major_formatter(mdates.DateFormatter('%b %y'))
ax.legend(loc='upper left', bbox_to_anchor=(0, 0.9))
ax.text(TERM_START + (TERM_END - TERM_START) / 2, 12, 'MDP-249 term', ha='center', color=BLUE, fontsize=8.5)
save(fig, '02-citizen-growth.png', 'Citizen NFT 0x6E46…E002 (Arbitrum): Transfer-from-zero events and expiresAt()')

fig, ax = plt.subplots(figsize=(9, 3.6))
shade_term(ax)
ax.step(t_days, t_minted, where='post', color=VIOLET, lw=2.2, label='External Teams (excl. Executive Branch)')
ax.axhline(30, color=RED, lw=1.2, ls='--')
ax.text(t_days[5], 30.3, 'KR target: 30 by month 4', color=RED, fontsize=8.5, va='bottom')
ax.axhline(20, color=GREY, lw=1, ls='--')
ax.text(t_days[5], 19.6, 'Baseline: 20', color=GREY, fontsize=8.5, va='top')
for t in metrics['teams']['newInTerm']:
    d = dt.datetime.fromisoformat(t['mintedAt']).replace(tzinfo=UTC)
    ax.plot([d], [count_at(t_tokens, d + dt.timedelta(hours=23))], 'o', color=VIOLET, ms=4)
ax.set_title('Team growth — Space Acceleration Network')
ax.set_ylabel('Teams')
ax.set_ylim(0, 33)
ax.xaxis.set_major_formatter(mdates.DateFormatter('%b %y'))
ax.legend(loc='upper left', bbox_to_anchor=(0, 0.85))
save(fig, '03-team-growth.png', 'Team NFT 0xAB2C…F55F (Arbitrum)')

# ------------------------------------------------------ jobs & marketplace ---

jobs = SNAP['jobs']
market = SNAP['marketplace']
in_term = lambda r: TERM_START.timestamp() <= int(r['timestamp']) <= AS_OF.timestamp()  # noqa: E731
jobs_new = [r for r in jobs if in_term(r)]
market_new = [r for r in market if in_term(r)]
ext = lambda rows: {int(r['teamId']) for r in rows if int(r['teamId']) != 0}  # noqa: E731
external_team_ids = sorted(t['id'] for t in t_tokens if t['mintedAt'] <= AS_OF.timestamp())
util_jobs, util_market = ext(jobs_new), ext(market_new)
util_either = util_jobs | util_market
metrics['utilization'] = {
    'externalTeams': len(external_team_ids),
    'newJobListings': len(jobs_new),
    'newJobListingsByEB': sum(1 for r in jobs_new if int(r['teamId']) == 0),
    'newMarketplaceListings': len(market_new),
    'teamsWithJobs': len(util_jobs),
    'teamsWithMarketplace': len(util_market),
    'teamsWithEither': len(util_either),
    'teamsWithBoth': len(util_jobs & util_market),
    'pctJobs': round(100 * len(util_jobs) / len(external_team_ids), 1),
    'pctMarketplace': round(100 * len(util_market) / len(external_team_ids), 1),
    'pctEither': round(100 * len(util_either) / len(external_team_ids), 1),
    'jobsTotalAllTime': len(jobs),
    'marketplaceTotalAllTime': len(market),
    'openJobsAsOf': sum(1 for r in jobs if int(r['endTime'] or 0) > AS_OF.timestamp()),
}

months = []
m = dt.datetime(2025, 1, 1, tzinfo=UTC)
while m <= AS_OF:
    months.append(m)
    m = (m.replace(day=28) + dt.timedelta(days=5)).replace(day=1)
mkey = lambda d: d.strftime('%Y-%m')  # noqa: E731
jc = collections.Counter(mkey(ts(r['timestamp'])) for r in jobs)
mc = collections.Counter(mkey(ts(r['timestamp'])) for r in market)
fig, ax = plt.subplots(figsize=(9, 3.6))
x = range(len(months))
jv = [jc.get(mkey(m), 0) for m in months]
mv = [mc.get(mkey(m), 0) for m in months]
ax.bar(x, mv, color=BLUE, label='Marketplace listings', width=0.75)
ax.bar(x, jv, bottom=mv, color=AMBER, label='Job listings', width=0.75)
term_idx = [i for i, m in enumerate(months) if TERM_START <= m <= AS_OF]
ax.axvspan(term_idx[0] - 0.5, term_idx[-1] + 0.5, color=BLUE, alpha=0.06, lw=0)
ax.set_xticks(list(x))
ax.set_xticklabels([m.strftime('%b\n%y') if m.month in (1, 4, 7, 10) else m.strftime('%b') for m in months], fontsize=8)
ax.set_title('New listings per month')
ax.set_ylabel('Listings created')
ax.legend(loc='upper left')
save(fig, '04-listings-per-month.png', 'Tableland JOBBOARD_42161_158 and MARKETPLACE_42161_159')

fig, ax = plt.subplots(figsize=(9, 2.9))
labels = [team_names.get(i, str(i)) for i in external_team_ids]
for row, (ids, label, color) in enumerate(
    [(util_jobs, 'Posted a job', AMBER), (util_market, 'Listed in marketplace', BLUE), (util_either, 'Either', TEAL)]
):
    for col, tid in enumerate(external_team_ids):
        ax.add_patch(
            plt.Rectangle((col, 2 - row), 0.92, 0.85, color=color if tid in ids else LIGHT, lw=0)
        )
ax.set_xlim(0, len(external_team_ids))
ax.set_ylim(0, 3)
ax.set_yticks([2.42, 1.42, 0.42])
ax.set_yticklabels(
    [
        f"Jobs  {metrics['utilization']['pctJobs']:.0f}%",
        f"Marketplace  {metrics['utilization']['pctMarketplace']:.0f}%",
        f"Either  {metrics['utilization']['pctEither']:.0f}%",
    ]
)
ax.set_xticks([i + 0.46 for i in range(len(labels))])
ax.set_xticklabels(labels, rotation=60, ha='right', fontsize=7)
ax.grid(False)
for s in ax.spines.values():
    s.set_visible(False)
ax.set_title('Team utilization of jobs and marketplace (1 May – 7 Oct 2026) — target 60%')
save(fig, '05-team-utilization.png', 'Tableland job board and marketplace, by teamId; 25 external Teams', y=-0.62)

# ----------------------------------------------------------- revenue -------

CIT = '0x6e464f19e0fef3db0f3ef9fd3da91a297dbfe002'
TEAM = '0xab2c354ec32880c143e87418f80acc06334ff55f'
JB = '0x2db6d704058e552defe415753465df8df0361846'
rev = collections.defaultdict(lambda: collections.Counter())
rev_window = {'trailing365': collections.Counter(), 'term': collections.Counter(), 'sinceTermStart': collections.Counter()}
for r in SNAP['treasuryEthInflows']:
    d = iso(r['executionDate'])
    src = {CIT: 'Citizen subscriptions', TEAM: 'Team subscriptions', JB: 'Launchpad fees'}.get(r['from'].lower())
    if not src:
        continue
    eth = int(r['value']) / 1e18
    rev[mkey(d)][src] += eth
    if AS_OF - dt.timedelta(days=365) <= d <= AS_OF:
        rev_window['trailing365'][src] += eth
    if TERM_START <= d <= TERM_END:
        rev_window['term'][src] += eth
    if TERM_START <= d <= AS_OF:
        rev_window['sinceTermStart'][src] += eth
price = SNAP['ethPriceUSD']
metrics['revenue'] = {
    'ethPriceUSD': price,
    **{
        k: {
            **{s: round(v, 5) for s, v in c.items()},
            'totalETH': round(sum(c.values()), 5),
            'totalUSDAtSpot': round(sum(c.values()) * price),
        }
        for k, c in rev_window.items()
    },
}
rmonths = [m for m in months if m >= dt.datetime(2025, 10, 1, tzinfo=UTC)]
fig, ax = plt.subplots(figsize=(9, 3.6))
bottom = [0] * len(rmonths)
for src, color in [('Citizen subscriptions', BLUE), ('Team subscriptions', VIOLET), ('Launchpad fees', AMBER)]:
    vals = [rev[mkey(m)][src] * price for m in rmonths]
    ax.bar(range(len(rmonths)), vals, bottom=bottom, color=color, label=src, width=0.7)
    bottom = [a + b for a, b in zip(bottom, vals)]
for i, v in enumerate(bottom):
    if v:
        ax.text(i, v + 25, f'${v:,.0f}', ha='center', fontsize=7.5, color=NAVY)
ax.set_ylim(0, max(bottom) * 1.1)
ax.set_xticks(range(len(rmonths)))
ax.set_xticklabels([m.strftime('%b %y') for m in rmonths], fontsize=8)
ax.set_ylabel(f'USD (ETH at ${price:,.0f})')
ax.set_title('Cash revenue into the Arbitrum treasury, by month')
ax.legend(loc='upper left')
save(fig, '06-revenue-by-month.png', 'Safe Transaction Service, ETH inflows to 0xAF26…70c0 classified by sending contract (same rule as /api/eb/financial-summary)')

# ----------------------------------------------------------- EB Safe -------

multisig = sorted(SNAP['ebSafe']['multisig'], key=lambda t: int(t['nonce']))


def transfers_of(tx):
    dd = tx.get('dataDecoded') or {}
    out = []

    def one(to, value, dec):
        to_l = to.lower()
        if dec and dec.get('method') == 'transfer':
            p = {x['name']: x['value'] for x in dec['parameters']}
            recipient = p.get('to') or p.get('dst') or list(p.values())[0]
            amount = p.get('value') or p.get('amount') or p.get('wad') or list(p.values())[1]
            sym, decs = TOKENS.get(to_l, (to_l[:8], 18))
            out.append({'to': recipient.lower(), 'asset': sym, 'amount': int(amount) / 10**decs})
        elif not dec and int(value or 0):
            out.append({'to': to_l, 'asset': 'ETH', 'amount': int(value) / 1e18})

    if dd.get('method') == 'multiSend':
        for x in dd['parameters'][0].get('valueDecoded') or []:
            one(x['to'], x['value'], x.get('dataDecoded'))
    else:
        one(tx['to'], tx['value'], dd or None)
    return out


CATEGORY = {
    36: 'Reimbursement',
    37: 'Prior-cycle pay owed',
    38: 'Prior-cycle rewards & bonus (pass-through)',
    39: 'Prior-cycle rewards & bonus (pass-through)',
    40: 'Payroll — May 2026',
    41: 'Wrap ETH for streams',
    42: 'Payroll — LlamaPay vesting Jun–Sep',
    43: 'Operations / sponsorship',
    44: 'Reimbursement',
    45: 'Reimbursement',
    46: 'Reimbursement',
    47: 'Reimbursement',
    48: 'Reimbursement',
}
ledger = []
for tx in multisig:
    n = int(tx['nonce'])
    if n < 36:
        continue
    row = {
        'nonce': n,
        'date': tx['executionDate'][:10],
        'txHash': tx['transactionHash'],
        'safeTxHash': tx['safeTxHash'],
        'category': CATEGORY.get(n, 'Other'),
        'transfers': [
            {**t, 'payee': PEOPLE.get(t['to'], t['to'])} for t in transfers_of(tx)
        ],
    }
    ledger.append(row)

streams = [
    {'payee': 'Pablo', 'wallet': PABLO, 'weth': 26.0422581, 'days': 120},
    {'payee': 'Ryan', 'wallet': RYAN_PAYOUT, 'weth': 16.27641131, 'days': 120},
    {'payee': 'Miguel', 'wallet': MIGUEL, 'weth': 8.952026221, 'days': 90},
    {'payee': 'Miguel', 'wallet': MIGUEL, 'weth': 1.49200437, 'days': 30},
]
for s in streams:
    s['usdAtFunding'] = round(s['weth'] * STREAM_ETH_USD, 2)
    s['start'] = '2026-06-01'
    s['end'] = (dt.date(2026, 6, 1) + dt.timedelta(days=s['days'])).isoformat()
    s['usdPer30Days'] = round(s['usdAtFunding'] / s['days'] * 30, 2)
metrics['streams'] = streams

may_payroll = {'Pablo': 12514.29, 'Ryan': 7871.43, 'Miguel': 2864.29}
# Nonce 40 also settled each member's unpaid April (prior-cycle) balance on top of the May rate.
may_rate = {'Pablo': 12000, 'Ryan': 7500, 'Miguel': 2750}
april_balance = {p: round(may_payroll[p] - may_rate[p], 2) for p in may_payroll}
paid = collections.Counter(may_rate)
for s in streams:
    paid[s['payee']] += s['usdAtFunding']
budget = {'Pablo': 60000, 'Ryan': 37500, 'Miguel': 22000}
reimb = collections.Counter()
for row in ledger:
    if row['category'] in ('Reimbursement', 'Operations / sponsorship'):
        for t in row['transfers']:
            if t['asset'] in ('USDC', 'DAI'):
                reimb[row['category']] += t['amount']
metrics['budgetVsActual'] = {
    'personnel': {p: {'budget': budget[p], 'paidUSD': round(paid[p], 2)} for p in budget},
    'personnelBudget': sum(budget.values()),
    'personnelPaidUSD': round(sum(paid.values()), 2),
    'opsFlexBudget': 12500,
    'opsFlexPaidUSD': round(sum(reimb.values()), 2),
    'bonusPoolBudget': 24000,
    'bonusPaid': 0,
    'aprilBalanceInNonce40': april_balance,
}

fig, ax = plt.subplots(figsize=(9, 3.8))
cats = ['Pablo', 'Ryan', 'Miguel', 'Ops + flex']
bud = [budget['Pablo'], budget['Ryan'], budget['Miguel'], 12500]
act = [paid['Pablo'], paid['Ryan'], paid['Miguel'], sum(reimb.values())]
xs = range(len(cats))
ax.bar([i - 0.2 for i in xs], bud, width=0.38, color=LIGHT, edgecolor=GREY, label='MDP-249 budget')
ax.bar([i + 0.2 for i in xs], act, width=0.38, color=BLUE, label='Paid for MDP-249 (USD at funding)')
for i, (b, a) in enumerate(zip(bud, act)):
    ax.text(i - 0.2, b + 800, f'${b/1000:,.1f}k', ha='center', fontsize=8, color=GREY)
    ax.text(i + 0.2, a + 800, f'${a/1000:,.1f}k', ha='center', fontsize=8, color=NAVY)
ax.set_xticks(list(xs))
ax.set_xticklabels(cats)
ax.set_ylabel('USD')
ax.set_title('Budget vs. actual — core five-month envelope ($132k)')
ax.legend(loc='upper right')
save(fig, '07-budget-vs-actual.png', 'EB Safe 0xdFc3…5291 nonces 36–48; LlamaPay deployments at $1,843.17/ETH')

flow = collections.defaultdict(collections.Counter)
for row in ledger:
    for t in row['transfers']:
        if row['category'].startswith('Payroll — LlamaPay') or row['category'].startswith('Wrap'):
            continue
        usd = t['amount'] if t['asset'] in ('USDC', 'DAI') else t['amount'] * STREAM_ETH_USD
        flow[row['date'][:7]][row['category']] += usd
for s in streams:
    for k in range(s['days']):
        d = dt.date(2026, 6, 1) + dt.timedelta(days=k)
        flow[d.strftime('%Y-%m')]['Payroll — LlamaPay (accrued)'] += s['usdAtFunding'] / s['days']
fmonths = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09']
fcats = [
    ('Payroll — May 2026', BLUE),
    ('Payroll — LlamaPay (accrued)', VIOLET),
    ('Prior-cycle pay owed', GREY),
    ('Prior-cycle rewards & bonus (pass-through)', '#C4B5FD'),
    ('Reimbursement', TEAL),
    ('Operations / sponsorship', AMBER),
]
fig, ax = plt.subplots(figsize=(9, 3.8))
bottom = [0] * len(fmonths)
for cname, color in fcats:
    vals = [flow[m][cname] for m in fmonths]
    ax.bar(range(len(fmonths)), vals, bottom=bottom, color=color, label=cname, width=0.65)
    bottom = [a + b for a, b in zip(bottom, vals)]
for i, v in enumerate(bottom):
    ax.text(i, v + 400, f'${v/1000:,.1f}k', ha='center', fontsize=8.5, color=NAVY)
ax.set_ylim(0, max(bottom) * 1.12)
ax.set_xticks(range(len(fmonths)))
ax.set_xticklabels(['May', 'Jun', 'Jul', 'Aug', 'Sep'])
ax.set_ylabel('USD')
ax.set_title('Executive Branch spend by month')
ax.legend(loc='upper left', bbox_to_anchor=(1.0, 1.0), fontsize=8)
save(fig, '08-eb-spend-by-month.png', 'EB Safe 0xdFc3…5291; stream value accrued linearly from 1 Jun 2026')
metrics['spendByMonth'] = {m: {k: round(v, 2) for k, v in flow[m].items()} for m in fmonths}
metrics['ebLedger'] = ledger

incoming = []
for r in SNAP['ebSafe']['incoming']:
    d = iso(r['executionDate'])
    if d < dt.datetime(2026, 4, 15, tzinfo=UTC):
        continue
    ti = r.get('tokenInfo') or {}
    decs = ti.get('decimals') or 18
    incoming.append(
        {
            'date': d.date().isoformat(),
            'type': r['type'],
            'asset': ti.get('symbol', 'ETH'),
            'amount': int(r['value'] or 0) / 10**decs,
            'from': r['from'],
            'txHash': r['transactionHash'],
        }
    )
metrics['ebIncoming'] = incoming
metrics['ebBalances'] = [
    {
        'asset': (b.get('token') or {}).get('symbol', 'ETH'),
        'amount': int(b['balance']) / 10 ** ((b.get('token') or {}).get('decimals') or 18),
    }
    for b in SNAP['ebSafe']['balances']
]

# ------------------------------------------------------ Overview Flight ----

vote = json.load(
    open(os.path.join(ROOT, '..', '..', '..', 'ui', 'lib', 'overview-path-vote', 'closed-snapshot.json'))
)
metrics['overviewVote'] = {k: v for k, v in vote.items() if k != 'voters'}
labels = {
    'option-a': 'A — Commit now to a stratospheric balloon',
    'option-b': 'B — Keep options open, continue fundraising',
    'option-c': 'C — Refunds',
    'abstain': 'Abstain',
}
fig, ax = plt.subplots(figsize=(9, 2.6))
res = vote['results']
ys = range(len(res))[::-1]
for y, r in zip(ys, res):
    color = BLUE if r['optionId'] == vote['winningOptionId'] else GREY
    ax.barh(y, r['percentage'], color=color, height=0.6)
    ax.text(r['percentage'] + 1, y, f"{r['percentage']:.1f}%  ·  {r['totalVoted']:,.0f} $OVERVIEW  ·  {r['voterCount']} voters", va='center', fontsize=8.5)
ax.set_yticks(list(ys))
ax.set_yticklabels([labels[r['optionId']] for r in res])
ax.set_xlim(0, 135)
ax.set_xlabel('% of $OVERVIEW voting weight')
ax.set_title(f"Overview Flight path-forward vote (15–22 Jun 2026) — {vote['totalVoters']} voters")
ax.grid(axis='y', visible=False)
save(fig, '09-overview-path-vote.png', 'ui/lib/overview-path-vote/closed-snapshot.json (vote id 3, frozen 22 Jun 2026)')

pays = SNAP['frankPayments']
reopen = dt.datetime(2026, 7, 9, tzinfo=UTC)
cum, total = [], 0
for p in pays:
    total += p['amountETH']
    cum.append(total)
pre = [p for p in pays if p['timestamp'] < reopen.timestamp()]
post = [p for p in pays if p['timestamp'] >= reopen.timestamp()]
metrics['overviewFlight'] = {
    'totalETH': round(total, 4),
    'contributions': len(pays),
    'uniqueBackers': len({p['payer'] for p in pays}),
    'preReopenETH': round(sum(p['amountETH'] for p in pre), 4),
    'preReopenContributions': len(pre),
    'postReopenETH': round(sum(p['amountETH'] for p in post), 4),
    'postReopenContributions': len(post),
    'postReopenUniqueBackers': len({p['payer'] for p in post}),
}
fig, ax = plt.subplots(figsize=(9, 3.6))
ax.step([ts(p['timestamp']) for p in pays], cum, where='post', color=BLUE, lw=2)
ax.axvline(reopen, color=VIOLET, ls='--', lw=1)
ax.text(reopen, 2, '  Campaign reopened 9 Jul', color=VIOLET, fontsize=8.5)
ax.axvline(dt.datetime(2026, 4, 27, tzinfo=UTC), color=GREY, ls=':', lw=1)
ax.text(dt.datetime(2026, 4, 27, tzinfo=UTC), 5, 'Phase 1 close 27 Apr  ', color=GREY, fontsize=8.5, ha='right')
ax.axvspan(dt.datetime(2026, 6, 15, tzinfo=UTC), dt.datetime(2026, 6, 22, tzinfo=UTC), color=AMBER, alpha=0.2, lw=0)
ax.text(dt.datetime(2026, 6, 18, tzinfo=UTC), 10, 'Path vote', color=AMBER, fontsize=8.5, ha='center', rotation=90)
ax.set_ylabel('Cumulative ETH (on-chain)')
ax.set_title('Overview Effect Flight — on-chain contributions (Juicebox project 73)')
ax.xaxis.set_major_formatter(mdates.DateFormatter('%d %b'))
save(fig, '10-overview-flight-contributions.png', 'Juicebox V5 terminal 0x2dB6…1846 Pay events, Arbitrum (on-chain only; card/off-chain excluded)')

# -------------------------------------------------------------- DePrize ----

names = {
    'arbitrum': {1: 'The Moon Is A Harsh Mistress', 2: 'Touchdown', 3: 'Night Shift', 4: 'First Tracks', 5: 'Water Ice'},
    'sepolia': {
        1: 'Touchdown (gen 1)', 2: 'Touchdown (gen 2)', 3: 'Night Shift', 4: 'Crewed lunar rover (withdrawn)',
        5: 'First Tracks', 6: 'Water Ice', 7: 'Touchdown v2 (Safe-owned)', 8: 'Demo prize (JB 276)',
    },
}
dp = {}
for chain, data in SNAP['deprize'].items():
    regs = data['registry']['registered']
    bets = data['bets']
    dp[chain] = {
        'registered': [
            {'id': r['args'][0], 'jbProject': r['args'][1], 'name': names[chain].get(r['args'][0], str(r['args'][0])), 'date': ts(r['timestamp']).date().isoformat()}
            for r in regs
        ],
        'bets': len(bets),
        'uniqueBettors': len({b['bettor'] for b in bets}),
        'volumeETH': round(sum(b['costETH'] for b in bets), 6),
        'prizeSliceETH': round(sum(b['sliceETH'] for b in bets), 6),
        'winners': [{'id': w['args'][0], 'team': w['args'][1], 'date': ts(w['timestamp']).date().isoformat()} for w in data['registry']['winnerDeclared']],
        'cancellations': [w['args'][0] for w in data['registry']['cancellationAnnounced']],
        'betsByWallet': dict(collections.Counter(PEOPLE.get(b['bettor'], 'Deployer' if b['bettor'] == DEPLOYER else 'Other') for b in bets)),
    }
metrics['deprize'] = dp

fig, ax = plt.subplots(figsize=(9, 3.4))
rows = [('arbitrum', r) for r in dp['arbitrum']['registered']] + [('sepolia', r) for r in dp['sepolia']['registered']]
for i, (chain, r) in enumerate(rows[::-1]):
    d = dt.datetime.fromisoformat(r['date']).replace(tzinfo=UTC)
    color = BLUE if chain == 'arbitrum' else GREY
    ax.plot([d, AS_OF], [i, i], color=color, lw=5, solid_capstyle='butt', alpha=0.85)
    ax.text(d - dt.timedelta(days=1), i, f"{'ARB' if chain == 'arbitrum' else 'SEP'} #{r['id']}  {r['name']}", ha='right', va='center', fontsize=7.5)
for chain, data in SNAP['deprize'].items():
    for b in data['bets']:
        rid = [k for k, (c, r) in enumerate(rows[::-1]) if c == chain and r['id'] == b['deprizeId']]
        if rid:
            ax.plot([ts(b['timestamp'])], [rid[0]], 'v', color=AMBER, ms=6, mec=NAVY, mew=0.4)
ax.set_yticks([])
ax.set_xlim(dt.datetime(2026, 7, 20, tzinfo=UTC), AS_OF + dt.timedelta(days=2))
ax.xaxis.set_major_formatter(mdates.DateFormatter('%d %b'))
ax.legend(
    handles=[Patch(color=BLUE, label='Arbitrum mainnet'), Patch(color=GREY, label='Sepolia rehearsal'),
             plt.Line2D([], [], marker='v', color=AMBER, ls='', label='Bet')],
    loc='upper left', bbox_to_anchor=(0.0, -0.1), ncol=3, fontsize=8,
)
ax.set_title('DePrize — competitions registered on-chain and bets placed')
ax.grid(axis='y', visible=False)
save(fig, '11-deprize-timeline.png', 'DePrizeRegistry DePrizeRegistered events and DePrizeMint Bet events (Arbitrum 0xf8B2…9924 / Sepolia 0x7208…84E2)')

# ---------------------------------------------------------- engineering ----

BUCKETS = [
    ('DePrize', r'deprize|prize|lmsr|ctf|\bbet|odds|touchdown|harsh'),
    ('Moonbase', r'moonbase|lunar|atlas|moon base|regolith|rover|habitat|district|globe|lander|ridge|sun'),
    ('Launchpad / Overview Flight', r'launchpad|frank|overview|mission|juicebox|\bjb\b|refund|onramp'),
    ('Project system & governance', r'project|proposal|vote|voting|senate|retro|cycle|governance|election|constitution'),
    ('Treasury & finance', r'treasury|financ|burn|revenue|aum|safe|llama|payout'),
    ('Network (Citizens, Teams, jobs, marketplace)', r'citizen|team|job|marketplace|network|profile|onboard|referral|xp|quest|dashboard|join'),
    ('Security, privacy & compliance', r'secur|audit|privy|auth|gdpr|geo|region|compliance|sms|terms|cookie|eu\b'),
]
AUTHORS = {'pmoncada': 'Pablo', 'mmoncada1': 'Miguel', 'ryand2d': 'Ryan', 'app/cursor': 'Cursor agent (unattributed)'}
prs = SNAP['mergedPRs']
by_author = collections.defaultdict(collections.Counter)
by_month = collections.defaultdict(collections.Counter)
for p in prs:
    a = AUTHORS.get(p['author']['login'], p['author']['login'])
    t = p['title'].lower()
    bucket = next((n for n, r in BUCKETS if re.search(r, t)), 'Other (UX, infra, docs)')
    by_author[a][bucket] += 1
    by_month[p['mergedAt'][:7]][a] += 1
metrics['engineering'] = {
    'mergedPRs': len(prs),
    'byAuthor': {a: dict(c) for a, c in by_author.items()},
    'byAuthorTotal': {a: sum(c.values()) for a, c in by_author.items()},
    'byMonth': {m: dict(c) for m, c in sorted(by_month.items())},
}
fig, ax = plt.subplots(figsize=(9, 3.6))
pm = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']
bottom = [0] * len(pm)
for a, color in [('Pablo', BLUE), ('Miguel', VIOLET), ('Ryan', TEAL), ('Cursor agent (unattributed)', GREY)]:
    vals = [by_month[m][a] for m in pm]
    ax.bar(range(len(pm)), vals, bottom=bottom, color=color, label=a, width=0.65)
    bottom = [x + y for x, y in zip(bottom, vals)]
for i, v in enumerate(bottom):
    ax.text(i, v + 1.5, str(v), ha='center', fontsize=8.5, color=NAVY)
ax.set_xticks(range(len(pm)))
ax.set_xticklabels(['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct (1–7)'])
ax.set_ylabel('Merged pull requests')
ax.set_title(f'Engineering throughput — {len(prs)} merged PRs to Official-MoonDao/MoonDAO')
ax.legend(loc='upper right', fontsize=8)
save(fig, '12-engineering-throughput.png', 'GitHub, merged PRs 1 May – 7 Oct 2026')

fig, ax = plt.subplots(figsize=(9, 3.8))
bnames = [n for n, _ in BUCKETS] + ['Other (UX, infra, docs)']
left = [0] * len(bnames)
for a, color in [('Pablo', BLUE), ('Miguel', VIOLET), ('Ryan', TEAL), ('Cursor agent (unattributed)', GREY)]:
    vals = [by_author[a][b] for b in bnames]
    ax.barh(range(len(bnames))[::-1], vals, left=left, color=color, label=a, height=0.65)
    left = [x + y for x, y in zip(left, vals)]
ax.set_yticks(list(range(len(bnames))[::-1]))
ax.set_yticklabels(bnames, fontsize=8.5)
ax.set_xlabel('Merged pull requests')
ax.set_title('Engineering focus by workstream')
ax.legend(loc='lower right', fontsize=8)
ax.grid(axis='y', visible=False)
save(fig, '13-engineering-by-workstream.png', 'GitHub merged PR titles, keyword-classified')

# --------------------------------------------------------- KR scorecard ----

cz, tm, ut = metrics['citizens'], metrics['teams'], metrics['utilization']
score = [
    ('Citizens 199 → 300', cz['mintedAsOf'] - 199, 300 - 199, f"{cz['mintedAsOf']} minted / {cz['activeAsOf']} active"),
    ('Teams 20 → 30', tm['externalAsOf'] - 20, 30 - 20, f"{tm['externalAsOf']} Teams"),
    ('Team utilization ≥ 60%', ut['pctEither'], 60, f"{ut['pctEither']:.0f}% of Teams"),
    ('15 new job listings', ut['newJobListings'], 15, f"{ut['newJobListings']} listings"),
    ('15 new marketplace listings', ut['newMarketplaceListings'], 15, f"{ut['newMarketplaceListings']} listings"),
]
metrics['scorecard'] = [
    {'kr': k, 'progress': v, 'target': t, 'pct': round(100 * v / t, 1), 'label': lab} for k, v, t, lab in score
]
fig, ax = plt.subplots(figsize=(9, 3.0))
for i, (k, v, t, lab) in enumerate(score[::-1]):
    pct = min(v / t, 1.25)
    color = TEAL if v >= t else (AMBER if v / t >= 0.5 else RED)
    ax.barh(i, 1, color=LIGHT, height=0.55)
    ax.barh(i, pct, color=color, height=0.55)
    ax.text(max(pct, 1) + 0.03, i, f'{100 * v / t:.0f}%  ·  {lab}', va='center', fontsize=8.5)
ax.axvline(1, color=NAVY, lw=1)
ax.set_yticks(range(len(score)))
ax.set_yticklabels([s[0] for s in score[::-1]])
ax.set_xlim(0, 1.7)
ax.set_xticks([0, 0.25, 0.5, 0.75, 1.0])
ax.set_xticklabels(['0%', '25%', '50%', '75%', '100%'])
ax.set_title('Objective 2 scorecard — progress toward target (growth measured from baseline)')
ax.grid(axis='y', visible=False)
save(fig, '01-objective-2-scorecard.png', 'Citizen/Team NFTs and Tableland listings, Arbitrum')

with open(os.path.join(ROOT, 'data', 'metrics.json'), 'w') as f:
    json.dump(metrics, f, indent=1, default=str)
print(json.dumps({k: metrics[k] for k in ['citizens', 'teams', 'utilization', 'revenue', 'budgetVsActual', 'overviewFlight', 'engineering']}, indent=1, default=str))
print(json.dumps(metrics['deprize'], indent=1))
